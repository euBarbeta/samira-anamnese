// netlify/functions/vincular-paciente-agendamento.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// ✅ FUNÇÃO LOCAL (Para evitar o erro "is not a function" na Netlify)
function sanitizarTexto(valor, { maxLength = 500, permitirQuebraLinha = false } = {}) {
  if (valor == null) return '';
  let texto = String(valor);
  texto = texto.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  texto = texto.replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '');
  texto = texto.replace(/<[^>]+>/g, '');
  texto = texto.replace(/javascript\s*:/gi, '');
  texto = texto.replace(/\bon\w+\s*=/gi, '');
  if (!permitirQuebraLinha) texto = texto.replace(/[\r\n]+/g, ' ');
  texto = texto.trim();
  if (texto.length > maxLength) texto = texto.slice(0, maxLength);
  return texto;
}

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

    const body = JSON.parse(event.body || '{}');
    const {
      uidEsteticista,
      agendamentoId,
      nome: nomeBruto,
      documento: docBruto,
    } = body;

    if (!uidEsteticista || !agendamentoId || !nomeBruto || !docBruto) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'dados incompletos' }),
      };
    }

    // ✅ Usa a função local de sanitização
    const nome = sanitizarTexto(nomeBruto, { maxLength: 100 });
    const documento = sanitizarTexto(docBruto, { maxLength: 30 });

    const nomeNorm = normalizarNome(nome);
    const docNorm = normalizarDoc(documento);

    if (!nomeNorm || !docNorm) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: true,
          vinculado: false,
          motivo: 'dados insuficientes para match',
        }),
      };
    }

    // ============================================================
    // 1) Busca paciente cadastrado com nome + documento iguais
    // ============================================================
    const snap = await db
      .collection(`usuarios/${uidEsteticista}/pacientes`)
      .get();

    let pacienteEncontrado = null;

    for (const d of snap.docs) {
      const p = d.data();
      const pNome = p.nome || p.anamnese?.nome || '';
      const pDoc = p.documento || p.anamnese?.numeroDocumento || '';

      if (
        normalizarNome(pNome) === nomeNorm &&
        normalizarDoc(pDoc) === docNorm
      ) {
        pacienteEncontrado = { id: d.id, ...p };
        break;
      }
    }

    if (!pacienteEncontrado) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: true,
          vinculado: false,
          motivo: 'paciente não cadastrado no app',
        }),
      };
    }

    // ============================================================
    // 2) Confirma que o agendamento existe
    // ============================================================
    const agRef = db.collection('agendamentos').doc(String(agendamentoId));
    const agSnap = await agRef.get();

    if (!agSnap.exists) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: true,
          vinculado: false,
          motivo: 'agendamento não encontrado',
        }),
      };
    }

    const ag = agSnap.data();

    // ============================================================
    // 3) Vincula + espelha contato se o agendamento não tiver
    // ============================================================
    const patch = {
      pacienteId: String(pacienteEncontrado.id),
      vinculadoEm: new Date().toISOString(),
    };

    if (!ag.telefone && pacienteEncontrado.telefone) {
      patch.telefone = pacienteEncontrado.telefone;
    }
    if (!ag.email && pacienteEncontrado.emailContato) {
      patch.email = pacienteEncontrado.emailContato;
    }

    await agRef.update(patch);

    // ============================================================
    // 4) Notifica o paciente
    // ============================================================
    try {
      const baseUrl =
        process.env.URL ||
        process.env.DEPLOY_PRIME_URL ||
        `https://${event.headers.host}`;

      await fetch(`${baseUrl}/.netlify/functions/notificar-paciente-agendamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pacienteId: String(pacienteEncontrado.id),
          tipoEvento: 'criado',
          agendamento: {
            id: agendamentoId,
            data: ag.data,
            horaInicio: ag.horaInicio,
            nome: ag.nome,
          },
        }),
      });
    } catch (e) {
      console.warn('Falha ao notificar paciente após vínculo:', e);
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        vinculado: true,
        pacienteId: String(pacienteEncontrado.id),
        pacienteNome: pacienteEncontrado.nome,
      }),
    };
  } catch (err) {
    console.error('❌ Erro vincular-paciente-agendamento:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};