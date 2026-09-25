// netlify/functions/checar-lembretes.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const MS = {
  segundos: 1000,
  minutos: 60 * 1000,
  horas: 60 * 60 * 1000,
  dias: 24 * 60 * 60 * 1000,
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

// ✅ Quantas tentativas antes de desistir de um lembrete sem inscrição
//    1440 = 24h com cron rodando a cada 1 minuto
const MAX_TENTATIVAS = 1440;

// ✅ Quantas falhas consecutivas de FCM antes de apagar o token
const MAX_FALHAS_FCM = 3;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  let secret = event.queryStringParameters?.secret;
  if (!secret && event.body) {
    try {
      secret = JSON.parse(event.body).secret;
    } catch (e) {}
  }

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    if (getApps().length === 0) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert({
          projectId: sa.project_id,
          clientEmail: sa.client_email,
          privateKey: sa.private_key,
        }),
      });
    }
    const db = getFirestore();

    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const agora = Date.now();
    const snap = await db
      .collection('lembretes_pendentes')
      .where('enviado', '==', false)
      .get();

    if (snap.empty) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ ok: true, enviados: 0 }),
      };
    }

    const prontos = snap.docs.filter((d) => {
      const s = d.data().sendAt;
      return typeof s === 'number' && s <= agora;
    });

    if (prontos.length === 0) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ ok: true, enviados: 0 }),
      };
    }

    const prontosOrdenados = [...prontos].sort(
      (a, b) => (a.data().sendAt || 0) - (b.data().sendAt || 0)
    );

    const LIMITE_POR_EXECUCAO = 6;
    const prontosParaEnviar = prontosOrdenados.slice(0, LIMITE_POR_EXECUCAO);

    const resultados = [];

    for (let i = 0; i < prontosParaEnviar.length; i++) {
      const doc = prontosParaEnviar[i];
      const data = doc.data();
      const tentativas = (data.tentativas || 0) + 1;

      const subDoc = await db
        .collection('push_subscriptions')
        .doc(data.pacienteId)
        .get();

      const subData = subDoc.exists ? subDoc.data() : null;

      // ============================================================
      // ✅ 1. Sem inscrição — NÃO marca como enviado, apenas tentativas
      // ============================================================
      if (!subData || (!subData.fcmToken && !subData.subscription)) {
        if (tentativas >= MAX_TENTATIVAS) {
          await doc.ref.update({
            enviado: true,
            erro: 'desistiu após 24h sem inscrição',
            enviadoEm: new Date().toISOString(),
            tentativas,
          });
          resultados.push({ id: doc.id, ok: false, desistiu: true });
        } else {
          await doc.ref.update({
            tentativas,
            ultimaTentativa: new Date().toISOString(),
            erro: 'sem inscrição — aguardando paciente registrar push',
          });
          resultados.push({ id: doc.id, ok: false, aguardando: true });
        }
        continue;
      }

      const tagUnica = `lembrete-${data.pacienteId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const titulo = data.titulo || 'Lembrete';
      const corpo = 'Você tem um lembrete da Samira Estética';

      let envioOk = false;
      let erroMsg = null;
      let fcmSucesso = false;
      let webSucesso = false;

      // ============================================================
      // ✅ 2. Tenta FCM (APK)
      // ============================================================
      if (subData.fcmToken) {
        try {
          await getMessaging().send({
            token: subData.fcmToken,
            notification: { title: titulo, body: corpo },
            data: {
              lembreteId: String(doc.id),
              url: '/',
              tag: tagUnica,
            },
            android: {
              priority: 'high',
              notification: {
                channelId: 'lembretes',
                sound: 'default',
                tag: tagUnica,
              },
            },
          });
          envioOk = true;
          fcmSucesso = true;
        } catch (e) {
          erroMsg = e.message;
          console.error('❌ Falha FCM:', titulo, '-', e.message);

          // ✅ Só remove o token após 3 falhas consecutivas
          const errosInvalidos = [
            'messaging/registration-token-not-registered',
            'messaging/invalid-registration-token',
            'messaging/invalid-argument',
          ];
          if (errosInvalidos.some((code) => e.message.includes(code))) {
            const falhasFcm = (data.falhasFcm || 0) + 1;
            if (falhasFcm >= MAX_FALHAS_FCM) {
              console.log('🗑️ Removendo fcmToken inválido (3 falhas):', data.pacienteId);
              await subDoc.ref.update({
                fcmToken: null,
                atualizadoEm: new Date().toISOString(),
              });
            } else {
              await doc.ref.update({ falhasFcm });
            }
          }
        }
      }

      // ============================================================
      // ✅ 3. Se FCM falhou (ou não existe), tenta web-push (PWA)
      // ============================================================
      if (!envioOk && subData.subscription) {
        try {
          const payloadWeb = JSON.stringify({
            title: titulo,
            body: corpo,
            tag: tagUnica,
            lembreteId: doc.id,
            url: '/',
          });
          await webpush.sendNotification(subData.subscription, payloadWeb);
          envioOk = true;
          webSucesso = true;
        } catch (e) {
          erroMsg = e.message;
          console.error('❌ Falha web-push:', titulo, '-', e.message);

          const statusCode = e.statusCode || 0;
          if (statusCode === 410 || statusCode === 404) {
            console.log('🗑️ Removendo subscription expirada:', data.pacienteId);
            await subDoc.ref.update({
              subscription: null,
              atualizadoEm: new Date().toISOString(),
            });
          }
        }
      }

      // ============================================================
      // ✅ 4. Nenhum canal funcionou — NÃO marca como enviado
      // ============================================================
      if (!envioOk) {
        await doc.ref.update({
          tentativas,
          ultimaTentativa: new Date().toISOString(),
          erro: erroMsg || 'falha no envio (fcm + webpush)',
        });
        resultados.push({ id: doc.id, ok: false, erro: erroMsg });
        continue;
      }

      // ============================================================
      // ✅ 5. Sucesso — reagenda (se intervalo) ou marca como enviado
      // ============================================================
      if (data.tipo === 'intervalo') {
        const num = parseInt(data.intervaloNumero, 10) || 1;
        const unidade = data.intervaloUnidade || 'horas';
        const intervaloMs = num * (MS[unidade] || MS.horas);
        const proximo = Date.now() + intervaloMs;

        const novaTag = `lembrete-${data.pacienteId}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`;

        await doc.ref.update({
          sendAt: proximo,
          tag: novaTag,
          ultimoEnvio: new Date().toISOString(),
          tentativas,
          erro: null,
        });

        resultados.push({
          id: doc.id,
          ok: true,
          reagendado: true,
          canal: fcmSucesso ? 'fcm' : 'webpush',
        });
      } else {
        await doc.ref.update({
          enviado: true,
          enviadoEm: new Date().toISOString(),
          erro: null,
          tentativas,
        });
        resultados.push({
          id: doc.id,
          ok: true,
          canal: fcmSucesso ? 'fcm' : 'webpush',
        });
      }

      if (i < prontosParaEnviar.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const restantes = prontosOrdenados.length - prontosParaEnviar.length;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        enviados: resultados.filter(r => r.ok).length,
        restantes,
        resultados,
      }),
    };
  } catch (err) {
    console.error('❌ Erro:', err.stack);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};