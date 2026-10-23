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

// ✅ Aumentado de 6 → 20 (cobre 20 lembretes no mesmo horário)
const LIMITE_POR_EXECUCAO = 20;

// ✅ Stagger entre envios — garante que cada notificação tenha seu "momento" no Android
const STAGGER_MS = 250;

// ✅ Desiste após 24h sem inscrição
const MAX_TENTATIVAS = 1440;

// ✅ Remove fcmToken só após 3 falhas consecutivas
const MAX_FALHAS_FCM = 3;

// ✅ UIDs das estetas (pra buscar o doc do paciente)
const UIDS_ESTETICISTAS = [
  'MZ5j3NpjlxY67yLRiEfg13TbPE32', // Samira
  'ZvzIxDhsh7WMZqvG5hcFQS0yd9I2', // MbTech
];

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
    try { secret = JSON.parse(event.body).secret; } catch (e) {}
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
        body: JSON.stringify({ ok: true, enviados: 0, restantes: 0 }),
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
        body: JSON.stringify({ ok: true, enviados: 0, restantes: 0 }),
      };
    }

    const prontosOrdenados = [...prontos].sort(
      (a, b) => (a.data().sendAt || 0) - (b.data().sendAt || 0)
    );

    const prontosParaEnviar = prontosOrdenados.slice(0, LIMITE_POR_EXECUCAO);

    const promessas = prontosParaEnviar.map((doc, idx) =>
      processarLembrete({
        doc, idx, db, webpush, getMessaging,
        STAGGER_MS, MAX_FALHAS_FCM,
      })
    );

    const settled = await Promise.allSettled(promessas);

    const resultados = settled.map((r, idx) => {
      if (r.status === 'fulfilled') return r.value;
      const doc = prontosParaEnviar[idx];
      return {
        id: doc.id,
        ok: false,
        erro: r.reason?.message || 'falha inesperada',
      };
    });

    const restantes = prontosOrdenados.length - prontosParaEnviar.length;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        enviados: resultados.filter((r) => r.ok).length,
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

/* ============================================================
   ✅ Verifica se o paciente está anonimizado.
   Retorna TRUE se estiver (lembrete deve ser ignorado).
   ============================================================ */
async function pacienteEstaAnonimizado(db, pacienteId) {
  if (!pacienteId) return false;

  for (const uidEst of UIDS_ESTETICISTAS) {
    try {
      const pacienteRef = db.doc(`usuarios/${uidEst}/pacientes/${pacienteId}`);
      const pacienteSnap = await pacienteRef.get();
      if (pacienteSnap.exists) {
        return Boolean(pacienteSnap.data().anonimizadoEm);
      }
    } catch (e) {
      console.warn(`Falha ao checar anonimização em ${uidEst}:`, e.message);
    }
  }
  return false;
}

/* ============================================================
   Processa UM lembrete — lógica isolada, roda em paralelo
   ============================================================ */
async function processarLembrete({
  doc, idx, db, webpush, getMessaging, STAGGER_MS, MAX_FALHAS_FCM,
}) {
  if (idx > 0) {
    await new Promise((r) => setTimeout(r, idx * STAGGER_MS));
  }

  const data = doc.data();
  const tentativas = (data.tentativas || 0) + 1;
  const agoraInterno = Date.now();

  // ============================================================
  // ✅ NOVO — PACIENTE ANONIMIZADO
  // ------------------------------------------------------------
  // Se o paciente foi anonimizado (excluiu conta OU a esteta
  // arquivou a pasta), este lembrete não deve ser enviado.
  //
  // Marca como `enviado: true` com erro explicativo — assim o
  // cron não reprocessa, e a esteta pode ver o histórico se
  // quiser debugar.
  //
  // ⚖️ LGPD: sem base legal pra notificar (consentimento revogado).
  // ============================================================
  try {
    const anonimizado = await pacienteEstaAnonimizado(db, data.pacienteId);
    if (anonimizado) {
      console.log(`⏭️ Lembrete ignorado — paciente ${data.pacienteId} está anonimizado.`);
      await doc.ref.update({
        enviado: true,
        enviadoEm: new Date().toISOString(),
        erro: 'paciente anonimizado — lembrete descartado',
        tentativas,
      });
      return { id: doc.id, ok: false, anonimizado: true };
    }
  } catch (e) {
    // Se falhar a checagem, segue o fluxo normal (não perde o lembrete
    // por um erro transitório do Firestore).
    console.warn('Falha ao checar anonimização (segue normal):', e.message);
  }

  const subDoc = await db
    .collection('push_subscriptions')
    .doc(data.pacienteId)
    .get();

  const subData = subDoc.exists ? subDoc.data() : null;

  // ✅ Sem inscrição — incrementa tentativas, não descarta
  if (!subData || (!subData.fcmToken && !subData.subscription)) {
    if (tentativas >= MAX_TENTATIVAS) {
      await doc.ref.update({
        enviado: true,
        erro: 'desistiu após 24h sem inscrição',
        enviadoEm: new Date().toISOString(),
        tentativas,
      });
      return { id: doc.id, ok: false, desistiu: true };
    }
    await doc.ref.update({
      tentativas,
      ultimaTentativa: new Date().toISOString(),
      erro: 'sem inscrição — aguardando paciente registrar push',
    });
    return { id: doc.id, ok: false, aguardando: true };
  }

  const tagUnica = `lembrete-${data.pacienteId}-${Date.now()}-${Math.random()
    .toString(36).slice(2, 8)}`;
  const titulo = data.titulo || 'Lembrete';
  const corpo = 'Você tem um lembrete da Samira Estética';

  const resultadosCanal = {
    fcm: { ok: false, erro: null },
    webpush: { ok: false, erro: null },
  };

  // 1️⃣ FCM (APK — celular)
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
      resultadosCanal.fcm.ok = true;
    } catch (e) {
      resultadosCanal.fcm.erro = e.message;
      console.error('❌ Falha FCM:', titulo, '-', e.message);

      const errosInvalidos = [
        'messaging/registration-token-not-registered',
        'messaging/invalid-registration-token',
        'messaging/invalid-argument',
      ];
      if (errosInvalidos.some((code) => e.message.includes(code))) {
        const falhasFcm = (data.falhasFcm || 0) + 1;
        if (falhasFcm >= MAX_FALHAS_FCM) {
          console.log('🗑️ Removendo fcmToken (3 falhas):', data.pacienteId);
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

  // 2️⃣ Web-push (PWA — PC e/ou celular) — SEMPRE tenta se existir
  if (subData.subscription) {
    try {
      const payloadWeb = JSON.stringify({
        title: titulo,
        body: corpo,
        tag: tagUnica,
        lembreteId: doc.id,
        url: '/',
      });
      await webpush.sendNotification(subData.subscription, payloadWeb);
      resultadosCanal.webpush.ok = true;
    } catch (e) {
      resultadosCanal.webpush.erro = e.message;
      console.error('❌ Falha web-push:', titulo, '-', e.message);

      const statusCode = e.statusCode || 0;
      if (statusCode === 410 || statusCode === 404) {
        await subDoc.ref.update({
          subscription: null,
          atualizadoEm: new Date().toISOString(),
        });
      }
    }
  }

  const envioOk = resultadosCanal.fcm.ok || resultadosCanal.webpush.ok;

  if (!envioOk) {
    await doc.ref.update({
      tentativas,
      ultimaTentativa: new Date().toISOString(),
      erro:
        resultadosCanal.fcm.erro ||
        resultadosCanal.webpush.erro ||
        'falha no envio',
    });
    return { id: doc.id, ok: false, erro: 'nenhum canal entregou' };
  }

  const canais = [];
  if (resultadosCanal.fcm.ok) canais.push('fcm');
  if (resultadosCanal.webpush.ok) canais.push('webpush');

  if (data.tipo === 'intervalo') {
    const num = parseInt(data.intervaloNumero, 10) || 1;
    const unidade = data.intervaloUnidade || 'horas';
    const intervaloMs = num * (MS[unidade] || MS.horas);

    let proximo = (data.sendAt || agoraInterno) + intervaloMs;
    if (proximo <= agoraInterno) {
      const saltos = Math.ceil((agoraInterno - proximo) / intervaloMs);
      proximo += saltos * intervaloMs;
    }

    const novaTag = `lembrete-${data.pacienteId}-${Date.now()}-${Math.random()
      .toString(36).slice(2, 6)}`;

    await doc.ref.update({
      sendAt: proximo,
      tag: novaTag,
      ultimoEnvio: new Date().toISOString(),
      tentativas,
      erro: null,
    });

    return {
      id: doc.id,
      ok: true,
      reagendado: true,
      proximo: new Date(proximo).toISOString(),
      canais,
    };
  } else {
    await doc.ref.update({
      enviado: true,
      enviadoEm: new Date().toISOString(),
      erro: null,
      tentativas,
    });
    return { id: doc.id, ok: true, canais };
  }
}