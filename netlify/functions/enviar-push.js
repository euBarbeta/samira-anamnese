// netlify/functions/enviar-push.js
const webpush = require('web-push');
const admin = require('firebase-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const missing = [];
  if (!process.env.VAPID_PUBLIC_KEY)          missing.push('VAPID_PUBLIC_KEY');
  if (!process.env.VAPID_PRIVATE_KEY)         missing.push('VAPID_PRIVATE_KEY');
  if (!process.env.VAPID_EMAIL)               missing.push('VAPID_EMAIL');
  if (!process.env.FIREBASE_SERVICE_ACCOUNT)  missing.push('FIREBASE_SERVICE_ACCOUNT');

  if (missing.length > 0) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Variáveis faltando', missing }),
    };
  }

  try {
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const { pacienteId, lembrete } = JSON.parse(event.body || '{}');
    if (!pacienteId || !lembrete) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Dados incompletos' }) };
    }

    const db = admin.firestore();
    const subDoc = await db.collection('push_subscriptions').doc(String(pacienteId)).get();

    if (!subDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Paciente sem inscrição' }) };
    }

    const subscription = subDoc.data().subscription;
    const payload = JSON.stringify({
      title: lembrete.titulo || 'Lembrete',
      body: 'Você tem um lembrete da Samira Estética',
      url: 'https://samira-anamnese.netlify.app',
    });

    await webpush.sendNotification(subscription, payload);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message: 'Push enviado' }),
    };
  } catch (err) {
    console.error('❌ Erro:', err.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message, stack: err.stack }),
    };
  }
};