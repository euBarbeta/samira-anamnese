// netlify/functions/notificar-foto.js
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

    const { uidEsteticista, pacienteId, pacienteNome } = JSON.parse(event.body || '{}');
    if (!uidEsteticista) return { statusCode: 400, headers: CORS, body: 'uidEsteticista obrigatório' };

    const subDoc = await db.collection('push_subscriptions_esteticistas').doc(String(uidEsteticista)).get();
    if (!subDoc.exists) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, enviado: false, motivo: 'sem inscrição' }) };
    }

    const subData = subDoc.data();
    const titulo = '📸 Nova foto recebida';
    const corpo = `${pacienteNome || 'Paciente'} enviou uma foto para a galeria.`;
    const tagUnica = `foto-${pacienteId}-${Date.now()}`;

    const resultados = { fcm: false, webpush: false };

    // ============================================================
    // 1) FCM (APK da esteticista)
    // ============================================================
    if (subData.fcmToken) {
      try {
        await getMessaging().send({
          token: subData.fcmToken,
          notification: { title: titulo, body: corpo },
          data: {
            tipo: 'nova_foto',
            pacienteId: String(pacienteId || ''),
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
        resultados.fcm = true;
      } catch (e) {
        console.error('❌ Falha FCM (esteticista):', e.message);
        // Limpa token inválido
        if (
          e.message.includes('registration-token-not-registered') ||
          e.message.includes('invalid-registration-token') ||
          e.message.includes('invalid-argument')
        ) {
          await subDoc.ref.update({ fcmToken: null, atualizadoEm: new Date().toISOString() });
        }
      }
    }

    // ============================================================
    // 2) Web-push (PWA da esteticista no navegador)
    // ============================================================
    if (subData.subscription) {
      try {
        const payloadWeb = JSON.stringify({
          title: titulo,
          body: corpo,
          tag: tagUnica,
          url: '/',
          tipo: 'nova_foto',
          pacienteId: String(pacienteId || ''),
        });
        await webpush.sendNotification(subData.subscription, payloadWeb);
        resultados.webpush = true;
      } catch (e) {
        console.error('❌ Falha web-push (esteticista):', e.message);
        const statusCode = e.statusCode || 0;
        if (statusCode === 410 || statusCode === 404) {
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
    console.error('Erro notificar-foto:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};