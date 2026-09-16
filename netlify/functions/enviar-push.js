// netlify/functions/enviar-push.js
const webpush = require('web-push');
const admin = require('firebase-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let step = 'start';

  try {
    step = 'check-vapid';
    if (!process.env.VAPID_PUBLIC_KEY)          throw new Error('VAPID_PUBLIC_KEY missing');
    if (!process.env.VAPID_PRIVATE_KEY)         throw new Error('VAPID_PRIVATE_KEY missing');
    if (!process.env.VAPID_EMAIL)               throw new Error('VAPID_EMAIL missing');
    if (!process.env.FIREBASE_SERVICE_ACCOUNT)  throw new Error('FIREBASE_SERVICE_ACCOUNT missing');

    step = 'parse-service-account';
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('step: service account parsed. project_id =', serviceAccount.project_id);
    console.log('step: private_key length =', serviceAccount.private_key?.length);
    console.log('step: client_email =', serviceAccount.client_email);

    step = 'initialize-app';
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    console.log('step: firebase admin initialized');

    step = 'set-vapid';
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    console.log('step: vapid details set');

    step = 'parse-body';
    const { pacienteId, lembrete } = JSON.parse(event.body || '{}');
    if (!pacienteId || !lembrete) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Dados incompletos' }) };
    }

    step = 'get-subscription';
    const db = admin.firestore();
    const subDoc = await db.collection('push_subscriptions').doc(String(pacienteId)).get();
    console.log('step: subscription exists?', subDoc.exists);

    if (!subDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Paciente sem inscrição' }) };
    }

    step = 'send-notification';
    const subscription = subDoc.data().subscription;
    const payload = JSON.stringify({
      title: lembrete.titulo || 'Lembrete',
      body: 'Você tem um lembrete da Samira Estética',
      url: 'https://samira-anamnese.netlify.app',
    });

    await webpush.sendNotification(subscription, payload);
    console.log('step: ✅ push enviado');

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message: 'Push enviado' }),
    };
  } catch (err) {
    console.error('❌ ERRO no step:', step, '→', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
        step,                          // ← ISTO VAI DIZER ONDE QUEBROU
        stack: err.stack,
      }),
    };
  }
};