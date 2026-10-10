// netlify/functions/marcar-agendamento-reagendado.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    const { agendamentoId, novoAgendamentoId, nome, documento } =
      JSON.parse(event.body || '{}');

    if (!agendamentoId || !novoAgendamentoId || !nome || !documento) {
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

    // Só pode reagendar se estiver pendente/confirmado/faltou/cancelado
    if (!['pendente', 'confirmado', 'faltou', 'cancelado'].includes(ag.status)) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'este agendamento não pode ser reagendado' }),
      };
    }

    await ref.update({
      status: 'reagendado',
      reagendadoPara: String(novoAgendamentoId),
      reagendadoEm: new Date().toISOString(),
      ocultoParaPaciente: true,
      ocultadoPacienteEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('❌ Erro marcar-agendamento-reagendado:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};