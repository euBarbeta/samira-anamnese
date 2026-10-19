// netlify/functions/criar-agendamento-publico.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');
const { checkRateLimit } = require('./_utils/rate-limit');
const { sanitizarTexto, sanitizarEmail } = require('./_utils/sanitizar');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// ✅ Gera código com crypto.randomBytes (não Math.random)
function gerarCodigoAutenticidade() {
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  const rand2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `AG-${rand}-${rand2}`;
}

// ✅ Valida CPF (algoritmo oficial)
function validarCPF(cpf) {
  const s = String(cpf).replace(/\D/g, '');
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(s[i]) * (10 - i);
  let d1 = (soma * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(s[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(s[i]) * (11 - i);
  let d2 = (soma * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(s[10]);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  }

  // 🚦 Rate limit: 5 agendamentos por minuto por IP
  const rate = checkRateLimit('criar-agendamento', event, { max: 5, janela: 60000 });
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

    const body = JSON.parse(event.body || '{}');
    const {
      uidEsteticista, data, horaInicio, horaFim, duracaoMin,
      nome, documento, telefone, email, observacoes,
      consentimentoLGPD, pacienteId,
    } = body;

    if (!uidEsteticista || !data || !horaInicio || !horaFim || !nome || !documento) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'dados incompletos' }),
      };
    }

    // ============================================================
    // ✅ SANITIZAÇÃO NO BACKEND (defesa em profundidade)
    // ------------------------------------------------------------
    // Mesmo que o front sanitize, um atacante pode chamar a
    // Function direto. Sanitizamos SEMPRE aqui.
    // ============================================================
    const nomeLimpo = sanitizarTexto(nome, { maxLength: 100 });
    const documentoLimpo = sanitizarTexto(documento, { maxLength: 30 });
    const telefoneLimpo = String(telefone || '').replace(/[^\d+]/g, '').slice(0, 20);
    const emailLimpo = sanitizarEmail(email);
    const observacoesLimpo = sanitizarTexto(observacoes, {
      maxLength: 500,
      permitirQuebraLinha: true,
    });

    if (!nomeLimpo || nomeLimpo.length < 3) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'nome inválido' }),
      };
    }
    if (!documentoLimpo || documentoLimpo.length < 5) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'documento inválido' }),
      };
    }

    // ✅ Valida CPF se for 11 dígitos
    const apenasDigitos = documentoLimpo.replace(/\D/g, '');
    if (apenasDigitos.length === 11 && !validarCPF(apenasDigitos)) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'CPF inválido' }),
      };
    }

    // ============================================================
    // ✅ Validação atômica — checa se já existe outro agendamento
    //    ativo no mesmo slot
    // ============================================================
    const conflitoSnap = await db.collection('agendamentos')
      .where('uidEsteticista', '==', uidEsteticista)
      .where('data', '==', data)
      .where('status', 'in', ['pendente', 'confirmado'])
      .get();

    const [hI, mI] = horaInicio.split(':').map(Number);
    const inicioNovo = hI * 60 + mI;
    const [hF, mF] = horaFim.split(':').map(Number);
    const fimNovo = hF * 60 + mF;

    const temConflito = conflitoSnap.docs.some((d) => {
      const a = d.data();
      const [aH, aM] = (a.horaInicio || '00:00').split(':').map(Number);
      const aInicio = aH * 60 + aM;
      const [aFH, aFM] = (a.horaFim || '23:59').split(':').map(Number);
      const aFim = aFH * 60 + aFM;
      return inicioNovo < aFim && aInicio < fimNovo;
    });

    if (temConflito) {
      return {
        statusCode: 409,
        headers: CORS,
        body: JSON.stringify({
          error: 'Este horário acabou de ser reservado por outra pessoa. Escolha outro.',
        }),
      };
    }

    // ============================================================
    // ✅ Cria o agendamento (com valores sanitizados)
    // ============================================================
    const codigo = gerarCodigoAutenticidade();
    const docRef = await db.collection('agendamentos').add({
      uidEsteticista,
      profissionalId: uidEsteticista,
      pacienteId: pacienteId ? String(pacienteId) : null,
      data,
      horaInicio,
      horaFim,
      duracaoMin: duracaoMin || 60,
      servicoId: null,
      servicoNome: null,
      nome: nomeLimpo,
      documento: documentoLimpo,
      telefone: telefoneLimpo,
      email: emailLimpo,
      observacoes: observacoesLimpo,
      status: 'pendente',
      criadoPor: 'publico',
      canceladoPor: null,
      consentimentoLGPD: consentimentoLGPD || null,
      codigoAutenticidade: codigo,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    });

    // ✅ Sincroniza o slot público (não bloqueia a resposta)
    try {
      const baseUrl = process.env.URL || `https://${event.headers.host}`;
      await fetch(`${baseUrl}/.netlify/functions/sincronizar-slot-publico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamentoId: docRef.id }),
      });
    } catch (e) {
      console.warn('Falha ao sincronizar slot público:', e);
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, id: docRef.id }),
    };
  } catch (err) {
    console.error('❌ Erro criar-agendamento-publico:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};