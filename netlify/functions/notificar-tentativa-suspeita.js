// netlify/functions/notificar-tentativa-suspeita.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const UID_ESTETA_DONA = 'MZ5j3NpjlxY67yLRiEfg13TbPE32';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

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

    const { emailHash, totalTentativas } = JSON.parse(event.body || '{}');

    const subDoc = await db
      .collection('push_subscriptions_esteticistas')
      .doc(UID_ESTETA_DONA)
      .get();

    if (!subDoc.exists) return { statusCode: 200, body: JSON.stringify({ ok: true, enviado: false }) };

    const subData = subDoc.data();
    const titulo = '🚨 Tentativas de login suspeitas';
    const corpo = `Um usuário errou a senha ${totalTentativas}x seguidas. Abra o painel pra bloquear.`;
    const tagUnica = `suspeito-${emailHash}-${Date.now()}`;

    const resultados = { fcm: false, webpush: false };

    if (subData.fcmToken) {
      try {
        await getMessaging().send({
          token: subData.fcmToken,
          notification: { title: titulo, body: corpo },
          data: {
            tipo: 'tentativa_suspeita',
            emailHash,
            url: '/#seguranca',
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

    if (subData.subscription) {
      try {
        await webpush.sendNotification(
          subData.subscription,
          JSON.stringify({
            title: titulo,
            body: corpo,
            tag: tagUnica,
            url: '/#seguranca',
            tipo: 'tentativa_suspeita',
            emailHash,
          })
        );
        resultados.webpush = true;
      } catch (e) {
        console.error('Web-push falhou:', e.message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, enviado: resultados.fcm || resultados.webpush, resultados }),
    };
  } catch (err) {
    console.error('Erro notificar-tentativa-suspeita:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};