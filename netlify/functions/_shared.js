// netlify/functions/_shared.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function initFirebase() {
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
  return getFirestore();
}

function initWebpush() {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return webpush;
}

async function enviarPush(db, webpush, pacienteId, titulo) {
  const subDoc = await db.collection('push_subscriptions').doc(String(pacienteId)).get();
  if (!subDoc.exists) return { ok: false, erro: 'sem inscrição' };

  const subscription = subDoc.data().subscription;
  const payload = JSON.stringify({
    title: titulo || 'Lembrete',
    body: 'Você tem um lembrete da Samira Estética',
    url: 'https://samira-anamnese.netlify.app',
  });

  try {
    await webpush.sendNotification(subscription, payload);
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: err.message, statusCode: err.statusCode };
  }
}

module.exports = { initFirebase, initWebpush, enviarPush };