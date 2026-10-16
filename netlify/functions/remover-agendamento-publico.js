// netlify/functions/remover-agendamento-publico.js
//
// ⚖️ LGPD + Lei 13.787/2018
// ------------------------------------------------------------
// Antes: fazia DELETE FÍSICO do agendamento (viola obrigação legal)
// Depois: ANONIMIZA — apaga só contato, mantém nome/documento/histórico
//
// ⚠️ Isso NÃO é mais um "remover" no sentido de apagar — é um
//    "arquivar" que preserva o prontuário por 20 anos.

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { checkRateLimit } = require('./_utils/rate-limit');

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
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  }

  // 🚦 Rate limit: 5 remoções por minuto por IP
  const rate = checkRateLimit('remover-publico', event, { max: 5, janela: 60000 });
  if (!rate.ok) {
    return {
      statusCode: 429,
      headers: { ...CORS, 'Retry-After': String(rate.retryAfter) },
      body: JSON.stringify({ error: 'Muitas tentativas. Aguarde um pouco.' }),
    };
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

    // 🔒 Valida nome
    if (normalizarNome(ag.nome) !== normalizarNome(nome)) {
      return {
        statusCode: 403,
        headers: CORS,
        body: JSON.stringify({ error: 'nome não confere' }),
      };
    }

    // 🔒 Valida documento
    if (String(ag.documento || '').trim() !== String(documento).trim()) {
      return {
        statusCode: 403,
        headers: CORS,
        body: JSON.stringify({ error: 'documento não confere' }),
      };
    }

    // ⚖️ Só pode anonimizar se já estiver cancelado
    if (ag.status !== 'cancelado') {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({
          error: 'só é possível remover da lista agendamentos cancelados',
        }),
      };
    }

    // ⚖️ Se já foi anonimizado, não faz nada
    if (ag.anonimizadoEm) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ ok: true, jaAnonimizado: true }),
      };
    }

    // ============================================================
    // ⚖️ LGPD + Lei 13.787/2018
    // ------------------------------------------------------------
    // ANONIMIZAÇÃO (não delete):
    //   - Apaga: telefone, email, observações
    //   - MANTÉM: nome, documento, data, horaInicio, servicoNome,
    //             status, canceladoPor (tudo que é prontuário/registro)
    //   - Marca: anonimizadoEm, ocultoParaPaciente
    // ============================================================
    const agora = new Date().toISOString();

    await ref.update({
      // ⚠️ Apaga SÓ os dados de contato
      telefone: null,
      email: null,
      observacoes: null,

      // ✅ Nome e documento FICAM (são prontuário)
      // ✅ Data, hora, serviço, status FICAM (são histórico)

      // ⚖️ Marcadores LGPD
      anonimizadoEm: agora,
      anonimizadoPor: 'paciente-removeu-da-lista',

      // ✅ Esconde da lista do paciente
      ocultoParaPaciente: true,
      ocultadoPacienteEm: agora,

      atualizadoEm: agora,
    });

    // ============================================================
    // Sincroniza slot público (não bloqueia a resposta)
    // ============================================================
    try {
      const baseUrl = process.env.URL || `https://${event.headers.host}`;
      await fetch(`${baseUrl}/.netlify/functions/sincronizar-slot-publico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamentoId }),
      });
    } catch (e) {
      console.warn('Falha ao sincronizar slot público:', e);
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, anonimizado: true }),
    };
  } catch (err) {
    console.error('❌ Erro remover-agendamento-publico:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};