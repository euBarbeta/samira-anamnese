// netlify/functions/buscar-slots-ocupados.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

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

    const { uidEsteticista, dataInicio, dataFim } = JSON.parse(event.body || '{}');

    if (!uidEsteticista || !dataInicio || !dataFim) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'dados incompletos' }) };
    }

    const snap = await db.collection('agendamentos')
      .where('uidEsteticista', '==', uidEsteticista)
      .where('data', '>=', dataInicio)
      .where('data', '<=', dataFim)
      .get();

    // 🔒 Devolve SÓ os dados que o cálculo de slots precisa.
    //    Sem nome, sem documento, sem telefone — nada de PII.
    const ocupados = snap.docs
      .map((d) => d.data())
      .filter((a) => a.status === 'pendente' || a.status === 'confirmado')
      .map((a) => ({
        data: a.data,
        horaInicio: a.horaInicio,
        horaFim: a.horaFim || null,
        duracaoMin: a.duracaoMin || 60,
        liberacoesExtras: a.liberacoesExtras || null,
      }));

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, ocupados }),
    };
  } catch (err) {
    console.error('❌ Erro buscar-slots-ocupados:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};  