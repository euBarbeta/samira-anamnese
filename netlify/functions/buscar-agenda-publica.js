// netlify/functions/buscar-agenda-publica.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
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

    const { uidEsteticista } = JSON.parse(event.body || '{}');
    if (!uidEsteticista) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'uidEsteticista obrigatório' }) };
    }

    const snap = await db
      .doc(`usuarios/${uidEsteticista}/agenda_config/principal`)
      .get();

    if (!snap.exists) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, config: null }) };
    }

    const cfg = snap.data();

    // 🔒 Devolve SÓ o necessário para calcular slots.
    //    NÃO devolve: motivo dos bloqueios, histórico de edições, etc.
    const configPublica = {
      blocosSemanais: (cfg.blocosSemanais || []).map((b) => ({
        diaSemana: b.diaSemana,
        inicio: b.inicio,
        fim: b.fim,
        duracaoMin: b.duracaoMin || 60,
      })),
      // Datas específicas: só o que é público (blocos disponíveis).
      // Se for folga (bloqueado: true), só devolve a data bloqueada —
      // sem motivo, sem nada pessoal.
      datasEspecificas: Object.fromEntries(
        Object.entries(cfg.datasEspecificas || {})
          .filter(([, v]) => v && typeof v === 'object')
          .map(([k, v]) => [
            k,
            v.bloqueado
              ? { bloqueado: true }
              : {
                  bloqueado: false,
                  blocos: (v.blocos || []).map((b) => ({
                    inicio: b.inicio,
                    fim: b.fim,
                    duracaoMin: b.duracaoMin || 60,
                  })),
                },
          ])
      ),
      // Bloqueios globais: só as datas, sem motivo.
      bloqueios: (cfg.bloqueios || []).map((b) => ({ data: b.data })),
      diasFuturosMaximo: cfg.diasFuturosMaximo ?? 60,
      antecedenciaMinimaHoras: cfg.antecedenciaMinimaHoras ?? 4,
    };

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, config: configPublica }),
    };
  } catch (err) {
    console.error('❌ Erro buscar-agenda-publica:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
}; 