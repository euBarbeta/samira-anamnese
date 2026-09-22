// netlify/functions/checar-lembretes.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// ❌ SEM exports.config → agendador nativo DESATIVADO
// ✅ Quem chama agora é o cron-job.org externo

const MS = {
  segundos: 1000,
  minutos: 60 * 1000,
  horas: 60 * 60 * 1000,
  dias: 24 * 60 * 60 * 1000,
};

// Cabeçalhos que liberam o cron externo
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  // ✅ Responde OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // ✅ Aceita GET e POST
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // ✅ Valida o secret
  let secret = event.queryStringParameters?.secret;
  if (!secret && event.body) {
    try {
      secret = JSON.parse(event.body).secret;
    } catch (e) {
      // corpo não era JSON, ignora
    }
  }

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    // ✅ Inicializa Firebase Admin (uma única vez)
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

    // ✅ Ordena por sendAt (mais antigos primeiro)
    const prontosOrdenados = [...prontos].sort(
      (a, b) => (a.data().sendAt || 0) - (b.data().sendAt || 0)
    );

    // ✅ Limita para não estourar o timeout do Netlify (10s padrão)
    const LIMITE_POR_EXECUCAO = 6;
    const prontosParaEnviar = prontosOrdenados.slice(0, LIMITE_POR_EXECUCAO);

    const resultados = [];

    for (let i = 0; i < prontosParaEnviar.length; i++) {
      const doc = prontosParaEnviar[i];
      const data = doc.data();

      const subDoc = await db
        .collection('push_subscriptions')
        .doc(data.pacienteId)
        .get();

      if (!subDoc.exists) {
        await doc.ref.update({
          enviado: true,
          erro: 'sem inscrição',
          enviadoEm: new Date().toISOString(),
        });
        continue;
      }

      const subData = subDoc.data(); // ✅ AGORA DEFINIDO

      // ✅ Tag única (mesma para FCM e web-push)
      const tagUnica = `lembrete-${data.pacienteId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      const titulo = data.titulo || 'Lembrete';
      const corpo = 'Você tem um lembrete da Samira Estética';

      let envioOk = false;
      let erroMsg = null;

      // ============================================================
      // ✅ 1. Envia via FCM (app nativo / APK)
      // ============================================================
      if (subData.fcmToken) {
        try {
          await admin.messaging().send({
            token: subData.fcmToken,
            notification: {
              title: titulo,
              body: corpo,
            },
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
        } catch (e) {
          erroMsg = e.message;
          console.error('❌ Falha no envio FCM:', titulo, '-', e.message);
        }
      }
      // ============================================================
      // ✅ 2. Envia via web-push (PWA no navegador)
      // ============================================================
      else if (subData.subscription) {
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
        } catch (e) {
          erroMsg = e.message;
          console.error('❌ Falha no envio web-push:', titulo, '-', e.message);
        }
      }
      // ============================================================
      // ❌ 3. Sem inscrição (nem FCM nem web-push)
      // ============================================================
      else {
        await doc.ref.update({
          enviado: true,
          erro: 'sem inscrição',
          enviadoEm: new Date().toISOString(),
        });
        continue;
      }

      // ✅ Atualiza o lembrete conforme o tipo
      if (data.tipo === 'intervalo' && envioOk) {
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
          tentativas: (data.tentativas || 0) + 1,
        });

        resultados.push({ id: doc.id, ok: true, reagendado: true });
      } else {
        await doc.ref.update({
          enviado: envioOk,
          enviadoEm: envioOk ? new Date().toISOString() : null,
          erro: erroMsg,
          tentadoEm: new Date().toISOString(),
        });
        resultados.push({ id: doc.id, ok: envioOk });
      }

      // ✅ Delay de 1s entre notificações (exceto na última)
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
        enviados: resultados.length,
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