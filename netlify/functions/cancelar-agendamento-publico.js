// netlify/functions/cancelar-agendamento-publico.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function normalizarNome(str) {
  return (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

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

    const { agendamentoId, nome, documento } = JSON.parse(event.body || '{}');

    if (!agendamentoId || !nome || !documento) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'dados incompletos' }),
      };
    }

    const ref = db.collection('agendamentos').doc(String(agendamentoId));
    const snap = await ref.get();

    if (!snap.exists) {
      return {
        statusCode: 404,
        headers: CORS,
        body: JSON.stringify({ error: 'agendamento não encontrado' }),
      };
    }

    const ag = snap.data();

    // 🔒 Valida nome + documento
    if (normalizarNome(ag.nome) !== normalizarNome(nome)) {
      return {
        statusCode: 403,
        headers: CORS,
        body: JSON.stringify({ error: 'nome não confere' }),
      };
    }

    if (String(ag.documento || '').trim() !== String(documento).trim()) {
      return {
        statusCode: 403,
        headers: CORS,
        body: JSON.stringify({ error: 'documento não confere' }),
      };
    }

    // Só pode cancelar se estiver pendente ou confirmado
    if (!['pendente', 'confirmado'].includes(ag.status)) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'este agendamento não pode mais ser cancelado' }),
      };
    }

    await ref.update({
      status: 'cancelado',
      canceladoPor: 'paciente',
      atualizadoEm: new Date().toISOString(),
    });

    // Notifica a esteticista
    try {
      const baseUrl =
        process.env.URL ||
        process.env.DEPLOY_PRIME_URL ||
        `https://${event.headers.host}`;

      await fetch(`${baseUrl}/.netlify/functions/notificar-agendamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoEvento: 'cancelado_paciente',
          uidEsteticista: ag.uidEsteticista,
          agendamento: {
            id: agendamentoId,
            nome: ag.nome,
            data: ag.data,
            horaInicio: ag.horaInicio,
          },
        }),
      });
    } catch (e) {
      console.warn('Falha ao notificar cancelamento:', e);
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('❌ Erro cancelar-agendamento-publico:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};