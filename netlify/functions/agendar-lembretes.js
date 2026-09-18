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

    const { pacienteId, lembretes } = JSON.parse(event.body || '{}');
    if (!pacienteId || !Array.isArray(lembretes)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Dados incompletos' }) };
    }

    // ✅ PASSO 1: Apaga TODOS os lembretes pendentes desse paciente
    // (evita que lembretes removidos continuem disparando)
    const pendentesAntigos = await db.collection('lembretes_pendentes')
      .where('pacienteId', '==', String(pacienteId))
      .where('enviado', '==', false)
      .get();

    if (!pendentesAntigos.empty) {
      const batch = db.batch();
      pendentesAntigos.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      console.log(`🗑️ ${pendentesAntigos.size} lembrete(s) antigo(s) removido(s)`);
    }

    // ✅ PASSO 2: Cria os novos lembretes a partir da ficha atual
    const resultados = [];
    const agora = Date.now();

    for (const lembrete of lembretes) {
      if (!lembrete.titulo || !lembrete.titulo.trim()) continue;

      let sendAt;
      if (lembrete.tipo === 'data_hora') {
        if (!lembrete.valor) continue;

        // Ajuste de fuso: input "2026-09-16T14:30" é hora local (BRT = UTC-3)
        const partes = lembrete.valor.split(/[-T:]/);
        const [ano, mes, dia, hora, min] = partes.map(Number);
        sendAt = Date.UTC(ano, mes - 1, dia, hora + 3, min);
      } else {
        const num = parseInt(lembrete.intervaloNumero, 10) || 1;
        const unidade = lembrete.intervaloUnidade || 'horas';
        sendAt = Date.now() + (num * (MS[unidade] || MS.horas));
      }

      if (isNaN(sendAt)) continue;

      // Envio imediato (dentro de 30s)
      if (sendAt <= agora + 30000) {
        const subDoc = await db.collection('push_subscriptions').doc(String(pacienteId)).get();
        if (!subDoc.exists) {
          resultados.push({ titulo: lembrete.titulo, tipo: 'imediato', ok: false, erro: 'sem inscrição' });
          continue;
        }

        const subscription = subDoc.data().subscription;
        const payload = JSON.stringify({
  title: lembrete.titulo,
  body: 'Você tem um lembrete da Samira Estética',
  tag: `lembrete-${pacienteId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  lembreteId: `imediato-${Date.now()}`
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
  tipo: lembrete.tipo,
  intervaloNumero: lembrete.intervaloNumero || null,
  intervaloUnidade: lembrete.intervaloUnidade || null,
  enviado: false,
  criadoEm: new Date().toISOString(),
  // ✅ guarda uma tag única por lembrete (será usado no push)
  tag: `lembrete-${pacienteId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
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