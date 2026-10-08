// netlify/functions/checar-lembretes-paciente.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const JANELA_24H = { min: 23 * 60 + 30, max: 24 * 60 + 30 }; // 23h30–24h30
const JANELA_1H  = { min: 50,           max: 70 };          // 50–70 min

const TZ_OFFSET_MIN = -3 * 60; // Brasil (UTC-3)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
 // ✅ ADICIONE ESTE BLOCO AQUI
  let secret = event.queryStringParameters?.secret;
  if (!secret && event.body) {
    try { secret = JSON.parse(event.body).secret; } catch (e) {}
  }
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  // ✅ FIM DO BLOCO
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

    // Range: hoje + amanhã (BR)
    const agoraUTC = new Date();
    const agoraBR = new Date(agoraUTC.getTime() + TZ_OFFSET_MIN * 60 * 1000);
    const hojeBR = agoraBR.toISOString().split('T')[0];

    const amanha = new Date(agoraBR);
    amanha.setDate(amanha.getDate() + 1);
    const amanhaBR = amanha.toISOString().split('T')[0];

    const snap = await db
      .collection('agendamentos')
      .where('data', 'in', [hojeBR, amanhaBR])
      .get();

    if (snap.empty) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, checados: 0 }) };
    }

    let enviados24h = 0;
    let enviados1h = 0;
    const resultados = [];

    for (const doc of snap.docs) {
      const ag = doc.data();

      if (ag.status !== 'confirmado') continue;
      if (!ag.pacienteId) continue;                 // sem paciente vinculado
      if (!ag.data || !ag.horaInicio) continue;

      const [ano, mes, dia] = ag.data.split('-').map(Number);
      const [hora, minuto] = ag.horaInicio.split(':').map(Number);
      const dataAgUTC = new Date(
        Date.UTC(ano, mes - 1, dia, hora, minuto - TZ_OFFSET_MIN)
      );
      const diffMin = (dataAgUTC.getTime() - agoraUTC.getTime()) / 60000;

      if (diffMin < 0) continue;

      const precisa24h =
        !ag.lembrete24hEnviadoPaciente &&
        diffMin >= JANELA_24H.min &&
        diffMin <= JANELA_24H.max;

      const precisa1h =
        !ag.lembrete1hEnviadoPaciente &&
        diffMin >= JANELA_1H.min &&
        diffMin <= JANELA_1H.max;

      if (!precisa24h && !precisa1h) continue;

      const subDoc = await db
        .collection('push_subscriptions')
        .doc(String(ag.pacienteId))
        .get();

      if (!subDoc.exists) continue;

      const subData = subDoc.data();

      let titulo, corpo;
      if (precisa24h) {
        titulo = '📅 Lembrete: consulta amanhã';
        corpo = `Você tem consulta amanhã às ${ag.horaInicio}${ag.servicoNome ? ` · ${ag.servicoNome}` : ''}.`;
      } else {
        titulo = '⏰ Consulta em 1 hora';
        corpo = `Sua consulta é às ${ag.horaInicio}${ag.servicoNome ? ` · ${ag.servicoNome}` : ''}. Até já!`;
      }

      const tagUnica = `lembrete-pac-${precisa24h ? '24h' : '1h'}-${doc.id}`;
      const resultadosCanal = { fcm: false, webpush: false };

      // FCM (APK)
      if (subData.fcmToken) {
        try {
          await getMessaging().send({
            token: subData.fcmToken,
            notification: { title: titulo, body: corpo },
            data: {
              tipo: 'lembrete_agendamento_paciente',
              agendamentoId: String(doc.id),
              url: '/',
              tag: tagUnica,
            },
            android: {
              priority: 'high',
              notification: { channelId: 'lembretes', sound: 'default', tag: tagUnica },
            },
          });
          resultadosCanal.fcm = true;
        } catch (e) {
          console.error('FCM falhou:', e.message);
          if (
            e.message.includes('registration-token-not-registered') ||
            e.message.includes('invalid-registration-token') ||
            e.message.includes('invalid-argument')
          ) {
            await subDoc.ref.update({ fcmToken: null, atualizadoEm: new Date().toISOString() });
          }
        }
      }

      // Web-push (PWA)
      if (subData.subscription) {
        try {
          await webpush.sendNotification(
            subData.subscription,
            JSON.stringify({
              title: titulo,
              body: corpo,
              tag: tagUnica,
              url: '/',
              tipo: 'lembrete_agendamento_paciente',
              agendamentoId: String(doc.id),
            })
          );
          resultadosCanal.webpush = true;
        } catch (e) {
          console.error('Web-push falhou:', e.message);
          const code = e.statusCode || 0;
          if (code === 410 || code === 404) {
            await subDoc.ref.update({ subscription: null, atualizadoEm: new Date().toISOString() });
          }
        }
      }

      const envioOk = resultadosCanal.fcm || resultadosCanal.webpush;

      if (envioOk) {
        const update = { atualizadoEm: new Date().toISOString() };
        if (precisa24h) update.lembrete24hEnviadoPaciente = true;
        if (precisa1h) update.lembrete1hEnviadoPaciente = true;
        await doc.ref.update(update);

        if (precisa24h) enviados24h++;
        if (precisa1h) enviados1h++;
      }

      resultados.push({
        id: doc.id,
        paciente: ag.nome,
        tipo: precisa24h ? '24h' : '1h',
        ok: envioOk,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, checados: snap.size, enviados24h, enviados1h, resultados }),
    };
  } catch (err) {
    console.error('❌ Erro:', err.stack);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};