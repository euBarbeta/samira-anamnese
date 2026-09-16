// netlify/functions/enviar-push.js
const webpush = require('web-push');
const admin = require('firebase-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // 1) VALIDA TODAS AS VARIÁVEIS ANTES DE QUALQUER COISA
  const missing = [];
  if (!process.env.VAPID_PUBLIC_KEY)   missing.push('VAPID_PUBLIC_KEY');
  if (!process.env.VAPID_PRIVATE_KEY)  missing.push('VAPID_PRIVATE_KEY');
  if (!process.env.VAPID_EMAIL)        missing.push('VAPID_EMAIL');
  if (!process.env.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');
  if (!process.env.FIREBASE_CLIENT_EMAIL) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!process.env.FIREBASE_PRIVATE_KEY) missing.push('FIREBASE_PRIVATE_KEY');

  if (missing.length > 0) {
    console.error('❌ Variáveis faltando:', missing);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Variáveis de ambiente faltando',
        missing,
      }),
    };
  }

  // 2) INICIALIZA (só agora é seguro)
  try {
    console.log('🟢 [1/6] Antes de initializeApp');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    console.log('🟢 [2/6] Firebase Admin OK');

    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    console.log('🟢 [3/6] VAPID OK');

    const { pacienteId, lembrete } = JSON.parse(event.body || '{}');
    if (!pacienteId || !lembrete) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Dados incompletos' }) };
    }
    console.log('🟢 [4/6] Body OK. pacienteId:', pacienteId);

    const db = admin.firestore();
    const subDoc = await db.collection('push_subscriptions').doc(String(pacienteId)).get();
    console.log('🟢 [5/6] Firestore OK. Existe?', subDoc.exists);

    if (!subDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Paciente sem inscrição' }) };
    }

    const { subscription } = subDoc.data();
    console.log('🟢 Subscription recebida:', JSON.stringify(subscription).slice(0, 200));

    const payload = JSON.stringify({
      title: lembrete.titulo || 'Lembrete',
      body: 'Você tem um lembrete da Samira Estética',
      url: 'https://samira-anamnese.netlify.app',
    });

    console.log('🟢 [6/6] Enviando...');
    await webpush.sendNotification(subscription, payload);
    console.log('✅ Push enviado!');

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message: 'Push enviado' }),
    };
  } catch (err) {
    console.error('❌ Erro capturado:', err);
    console.error('❌ Stack:', err.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
        stack: err.stack,
        statusCode: err.statusCode || null,
      }),
    };
  }}