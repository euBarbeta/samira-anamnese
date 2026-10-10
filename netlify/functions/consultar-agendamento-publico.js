// netlify/functions/consultar-agendamento-publico.js
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

function normalizarDoc(str) {
  return (str || '').replace(/\D/g, '');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
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

    const { nome, documento } = JSON.parse(event.body || '{}');

    if (!nome || !documento) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'nome e documento são obrigatórios' }),
      };
    }

    const nomeNorm = normalizarNome(nome);
    const docNorm = normalizarDoc(documento);

    if (!nomeNorm || !docNorm) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'dados insuficientes para busca' }),
      };
    }

    // Busca por documento (o índice ajuda — se tiver)
    const snap = await db
      .collection('agendamentos')
      .where('documento', '==', documento.trim())
      .get();

    // Filtra por nome normalizado + oculta reagendados
    const lista = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => normalizarNome(a.nome) === nomeNorm)
      .filter((a) => a.status !== 'reagendado')
      // ⚠️ IMPORTANTE: devolve SÓ os campos que a tela pública precisa
      //    — nada de uidEsteticista, pacienteId, etc.
      .map((a) => ({
        id: a.id,
        nome: a.nome,
        documento: a.documento,
        data: a.data,
        horaInicio: a.horaInicio,
        horaFim: a.horaFim || null,
        servicoNome: a.servicoNome || null,
        status: a.status,
        canceladoPor: a.canceladoPor || null,
        observacoes: a.observacoes || null,
        telefone: a.telefone || null,
        email: a.email || null,
        uidEsteticista: a.uidEsteticista, // necessário pra reagendar
      }))
      .sort((a, b) => {
        const ka = `${a.data} ${a.horaInicio}`;
        const kb = `${b.data} ${b.horaInicio}`;
        return kb.localeCompare(ka);
      });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, agendamentos: lista }),
    };
  } catch (err) {
    console.error('❌ Erro consultar-agendamento-publico:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};