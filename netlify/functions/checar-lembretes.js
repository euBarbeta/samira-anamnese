// netlify/functions/checar-lembretes.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

exports.handler = async () => {
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

    const agora = Date.now();
    const snap = await db.collection('lembretes_pendentes').where('enviado', '==', false).get();

    if (snap.empty) {
      console.log('Nenhum lembrete pendente');
      return { statusCode: 200, body: JSON.stringify({ ok: true, enviados: 0 }) };
    }

    const prontos = snap.docs.filter(d => {
      const s = d.data().sendAt;
      return typeof s === 'number' && s <= agora;
    });

    if (prontos.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, enviados: 0 }) };
    }

    console.log(`📤 ${prontos.length} lembrete(s) para enviar`);

    const resultados = [];
    for (const doc of prontos) {
      const data = doc.data();
      const subDoc = await db.collection('push_subscriptions').doc(data.pacienteId).get();

      if (!subDoc.exists) {
        await doc.ref.update({ enviado: true, erro: 'sem inscrição', enviadoEm: new Date().toISOString() });
        continue;
      }

      const subscription = subDoc.data().subscription;
      const payload = JSON.stringify({
        title: data.titulo,
        body: 'Você tem um lembrete da Samira Estética',
        url: 'https://samira-anamnese.netlify.app',
      });

      try {
        await webpush.sendNotification(subscription, payload);
        await doc.ref.update({ enviado: true, enviadoEm: new Date().toISOString(), erro: null });
        resultados.push({ id: doc.id, ok: true });
      } catch (e) {
        await doc.ref.update({ enviado: false, erro: e.message, tentadoEm: new Date().toISOString() });
        resultados.push({ id: doc.id, ok: false, erro: e.message });
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, enviados: resultados.length, resultados }) };

  } catch (err) {
    console.error('❌ Erro:', err.stack);
    return { statusCode: 500, body: JSON.stringify({ error: err.message, stack: err.stack }) };
  }
};