// netlify/functions/sincronizar-slot-publico.js
//
// ⚡ Chamada SEMPRE que um agendamento muda de status.
//    Sincroniza a coleção pública `slots_ocupados_publicos`
//    para que a tela pública veja a mudança em tempo real.
//
//    Body: { agendamentoId }
//    — Lê o agendamento, e escreve/remove o slot público correspondente.

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Status que OCUPAM o slot (bloqueiam novos agendamentos)
const STATUS_OCUPADO = ['pendente', 'confirmado'];

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

    const { agendamentoId } = JSON.parse(event.body || '{}');
    if (!agendamentoId) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'agendamentoId obrigatório' }),
      };
    }

    // 1) Lê o agendamento
    const agRef = db.collection('agendamentos').doc(String(agendamentoId));
    const agSnap = await agRef.get();

    if (!agSnap.exists) {
      // Agendamento foi APAGADO — remove qualquer slot público dele
      // (não temos como saber a chave exata sem o doc, então tentamos
      //  remover por prefixo de ID — mas no seu caso, o ID do slot é
      //  derivado do agendamento, então é só deletar o doc com mesmo id)
      await db.collection('slots_ocupados_publicos').doc(String(agendamentoId)).delete().catch(() => {});
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ ok: true, removido: true }),
      };
    }

    const ag = agSnap.data();
    const { uidEsteticista, data, horaInicio, horaFim, status } = ag;

    // 2) Decisão: ocupa ou não ocupa?
    const ocupa = STATUS_OCUPADO.includes(status) && !ag.ocultoParaEsteticista;

    const slotRef = db.collection('slots_ocupados_publicos').doc(String(agendamentoId));

    if (ocupa) {
      // 3a) Escreve o slot público (SEM PII)
      await slotRef.set({
        uidEsteticista: String(uidEsteticista),
        data: data,
        horaInicio: horaInicio,
        horaFim: horaFim || null,
        duracaoMin: ag.duracaoMin || 60,
        liberacoesExtras: ag.liberacoesExtras || null,
        atualizadoEm: new Date().toISOString(),
      });
    } else {
      // 3b) Não ocupa mais → remove da coleção pública
      await slotRef.delete().catch(() => {});
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, ocupa }),
    };
  } catch (err) {
    console.error('❌ Erro sincronizar-slot-publico:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};