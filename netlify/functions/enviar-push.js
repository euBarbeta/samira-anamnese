// netlify/functions/enviar-push.js
const webpush = require('web-push');
const admin = require('firebase-admin');

// Inicializa Firebase Admin (só uma vez)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { pacienteId, lembrete } = JSON.parse(event.body);

    if (!pacienteId || !lembrete) {
      return { statusCode: 400, body: 'Dados incompletos' };
    }

    console.log('📨 Enviando push para paciente:', pacienteId);

    // Busca a inscrição salva
    const db = admin.firestore();
    const subDoc = await db
      .collection('push_subscriptions')
      .doc(String(pacienteId))
      .get();

    if (!subDoc.exists) {
      console.error('❌ Inscrição não encontrada para:', pacienteId);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Paciente não tem inscrição de push' }),
      };
    }

    const { subscription } = subDoc.data();
    console.log('✅ Inscrição encontrada, enviando...');

    const payload = JSON.stringify({
      title: lembrete.titulo || 'Lembrete',
      body: 'Você tem um lembrete da Samira Estética',
      url: 'https://samira-anamnese.netlify.app',
    });

    await webpush.sendNotification(subscription, payload);
    console.log('✅ Push enviado!');

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message: 'Push enviado' }),
    };
  } catch (err) {
    console.error('❌ Erro:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
        statusCode: err.statusCode || null,
      }),
    };
  }
};