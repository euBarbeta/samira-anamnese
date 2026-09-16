// netlify/functions/enviar-push.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // ✅ Inicializa usando a API MODERNA
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

    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const { pacienteId, lembrete } = JSON.parse(event.body || '{}');
    if (!pacienteId || !lembrete) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Dados incompletos' }) };
    }

    // ✅ Firestore pela API MODERNA
    const db = getFirestore();
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