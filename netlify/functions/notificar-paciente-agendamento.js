// netlify/functions/notificar-paciente-agendamento.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

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

    const { pacienteId, agendamento, tipoEvento = 'criado' } = JSON.parse(event.body || '{}');
    if (!pacienteId || !agendamento) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'dados incompletos' }) };
    }

    // ============================================================
    // Mapa de mensagens por tipo de evento
    // ============================================================
    const mapa = {
      criado: {
        titulo: '📅 Novo agendamento com a Samira',
        corpo: `Marcado para ${agendamento.data} às ${agendamento.horaInicio}. Toque para ver.`,
        tipoData: 'agendamento_criado',
      },
      confirmado: {
        titulo: '✅ Agendamento confirmado',
        corpo: `Sua consulta em ${agendamento.data} às ${agendamento.horaInicio} foi confirmada.`,
        tipoData: 'agendamento_confirmado',
      },
      cancelado: {
        titulo: '❌ Agendamento cancelado',
        corpo: `Sua consulta em ${agendamento.data} às ${agendamento.horaInicio} foi cancelada.`,
        tipoData: 'agendamento_cancelado',
      },
    };

    const info = mapa[tipoEvento] || mapa.criado;

    const subDoc = await db.collection('push_subscriptions').doc(String(pacienteId)).get();
    if (!subDoc.exists) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, enviado: false, motivo: 'sem inscrição' }) };
    }

    const subData = subDoc.data();
    const tagUnica = `agend-${pacienteId}-${Date.now()}`;

    const resultados = { fcm: false, webpush: false };

    // FCM (APK)
    if (subData.fcmToken) {
      try {
        await getMessaging().send({
          token: subData.fcmToken,
          notification: { title: info.titulo, body: info.corpo },
          data: {
            tipo: info.tipoData,
            tipoEvento,
            agendamentoId: String(agendamento.id || ''),
            url: '/',
            tag: tagUnica,
          },
          android: {
            priority: 'high',
            notification: { channelId: 'lembretes', sound: 'default', tag: tagUnica },
          },
        });
        resultados.fcm = true;
      } catch (e) {
        console.error('❌ FCM falhou:', e.message);
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
            title: info.titulo,
            body: info.corpo,
            tag: tagUnica,
            url: '/',
            tipo: info.tipoData,
            tipoEvento,
            agendamentoId: String(agendamento.id || ''),
          })
        );
        resultados.webpush = true;
      } catch (e) {
        console.error('❌ Web-push falhou:', e.message);
        const code = e.statusCode || 0;
        if (code === 410 || code === 404) {
          await subDoc.ref.update({ subscription: null, atualizadoEm: new Date().toISOString() });
        }
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        enviado: resultados.fcm || resultados.webpush,
        resultados,
      }),
    };
  } catch (err) {
    console.error('Erro notificar-paciente-agendamento:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};