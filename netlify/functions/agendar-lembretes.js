// netlify/functions/agendar-lembretes.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const MS = {
  segundos: 1000,
  minutos: 60 * 1000,
  horas: 60 * 60 * 1000,
  dias: 24 * 60 * 60 * 1000,
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Inicializa Firebase
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

    // Configura web-push
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const { pacienteId, lembretes } = JSON.parse(event.body || '{}');
    if (!pacienteId || !Array.isArray(lembretes)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Dados incompletos' }) };
    }

    const resultados = [];

    for (const lembrete of lembretes) {
      if (!lembrete.titulo || !lembrete.titulo.trim()) continue;

      let sendAt;
      if (lembrete.tipo === 'data_hora') {
        if (!lembrete.valor) continue;
        sendAt = new Date(lembrete.valor).getTime();
      } else {
        const num = parseInt(lembrete.intervaloNumero, 10) || 1;
        const unidade = lembrete.intervaloUnidade || 'horas';
        sendAt = Date.now() + (num * (MS[unidade] || MS.horas));
      }

      if (isNaN(sendAt)) continue;

      // Envio imediato (dentro de 30 segundos)
      if (sendAt <= Date.now() + 30000) {
        const subDoc = await db.collection('push_subscriptions').doc(String(pacienteId)).get();
        if (!subDoc.exists) {
          resultados.push({ titulo: lembrete.titulo, tipo: 'imediato', ok: false, erro: 'sem inscrição' });
          continue;
        }

        const subscription = subDoc.data().subscription;
        const payload = JSON.stringify({
          title: lembrete.titulo,
          body: 'Você tem um lembrete da Samira Estética',
          url: 'https://samira-anamnese.netlify.app',
        });

        try {
          await webpush.sendNotification(subscription, payload);
          resultados.push({ titulo: lembrete.titulo, tipo: 'imediato', ok: true });
        } catch (e) {
          resultados.push({ titulo: lembrete.titulo, tipo: 'imediato', ok: false, erro: e.message });
        }
      } else {
        // Agendado
        const docRef = await db.collection('lembretes_pendentes').add({
          pacienteId: String(pacienteId),
          titulo: lembrete.titulo,
          sendAt,
          enviado: false,
          criadoEm: new Date().toISOString(),
        });
        resultados.push({
          titulo: lembrete.titulo,
          tipo: 'agendado',
          sendAt: new Date(sendAt).toISOString(),
          docId: docRef.id,
        });
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, resultados }) };

  } catch (err) {
    console.error('❌ Erro:', err.stack);
    return { statusCode: 500, body: JSON.stringify({ error: err.message, stack: err.stack }) };
  }
};