// netlify/functions/notificar-agendamento.js
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

    const { tipoEvento, uidEsteticista, agendamento } = JSON.parse(event.body || '{}');
    if (!tipoEvento || !uidEsteticista || !agendamento) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'dados incompletos' }) };
    }

    // Títulos conforme o evento
    const mapa = {
      novo: {
        titulo: '🗓️ Novo agendamento',
        corpo: `${agendamento.nome} agendou para ${agendamento.data} às ${agendamento.horaInicio}`,
      },
      cancelado_paciente: {
        titulo: '❌ Agendamento cancelado',
        corpo: `${agendamento.nome} cancelou o horário de ${agendamento.data} às ${agendamento.horaInicio}`,
      },
      cancelado_esteticista: {
        titulo: '❌ Você cancelou um agendamento',
        corpo: `Horário ${agendamento.data} às ${agendamento.horaInicio} liberado`,
      },
      confirmado: {
        titulo: '✅ Agendamento confirmado',
        corpo: `${agendamento.nome} — ${agendamento.data} às ${agendamento.horaInicio}`,
      },
    };

    const info = mapa[tipoEvento] || {
      titulo: 'Atualização de agendamento',
      corpo: `${agendamento.nome} — ${agendamento.data} ${agendamento.horaInicio}`,
    };

    const subDoc = await db
      .collection('push_subscriptions_esteticistas')
      .doc(String(uidEsteticista))
      .get();

    if (!subDoc.exists) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, enviado: false }) };
    }

    const subData = subDoc.data();
    const tagUnica = `agend-${agendamento.id}-${Date.now()}`;
    const resultados = { fcm: false, webpush: false };

    // FCM (APK)
    if (subData.fcmToken) {
      try {
        await getMessaging().send({
          token: subData.fcmToken,
          notification: { title: info.titulo, body: info.corpo },
          data: {
            tipo: 'agendamento',
            tipoEvento,
            agendamentoId: String(agendamento.id),
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
        console.error('FCM falhou:', e.message);
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
            tipo: 'agendamento',
            tipoEvento,
            agendamentoId: String(agendamento.id),
          })
        );
        resultados.webpush = true;
      } catch (e) {
        console.error('Web-push falhou:', e.message);
        if (e.statusCode === 410 || e.statusCode === 404) {
          await subDoc.ref.update({ subscription: null });
        }
      }
    }

    // ============================================================
    // 📧 E-MAIL — Placeholder para configurar depois
    // ============================================================
    // Aqui você vai plugar Resend/SendGrid/EmailJS depois.
    // Exemplo (Resend):
    // await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    //   body: JSON.stringify({
    //     from: 'agenda@samira.com',
    //     to: process.env.EMAIL_SAMIRA,
    //     subject: info.titulo,
    //     html: `<p>${info.corpo}</p>`,
    //   }),
    // });
    console.log('📧 [placeholder] E-mail não enviado ainda:', info.titulo, '-', info.corpo);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, enviado: resultados.fcm || resultados.webpush, resultados }),
    };
  } catch (err) {
    console.error('Erro notificar-agendamento:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};