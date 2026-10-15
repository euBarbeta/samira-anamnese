// netlify/functions/buscar-agenda-publica.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// ✅ UID da Samira como fallback final
const UID_SAMIRA = 'MZ5j3NpjlxY67yLRiEfg13TbPE32';

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

    // ✅ Fallback: se o front não mandou uid, tenta a Samira
    let uidParaUsar = uidEsteticista || UID_SAMIRA;

    // ✅ Busca a config do uid recebido
    let snap = await db
      .doc(`usuarios/${uidParaUsar}/agenda_config/principal`)
      .get();

    // ✅ Se não achou e não é a Samira, tenta a Samira
    if (!snap.exists && uidParaUsar !== UID_SAMIRA) {
      snap = await db
        .doc(`usuarios/${UID_SAMIRA}/agenda_config/principal`)
        .get();
      uidParaUsar = UID_SAMIRA;
    }

    // ✅ Só retorna null se NENHUMA agenda (nem a Samira) estiver configurada
    if (!snap.exists) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ ok: true, config: null, uidUsado: uidParaUsar }),
      };
    }

    const cfg = snap.data();

    const configPublica = {
      blocosSemanais: (cfg.blocosSemanais || []).map((b) => ({
        diaSemana: b.diaSemana,
        inicio: b.inicio,
        fim: b.fim,
        duracaoMin: b.duracaoMin || 60,
      })),
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
      bloqueios: (cfg.bloqueios || []).map((b) => ({ data: b.data })),
      diasFuturosMaximo: cfg.diasFuturosMaximo ?? 60,
      antecedenciaMinimaHoras: cfg.antecedenciaMinimaHoras ?? 4,
    };

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        config: configPublica,
        uidUsado: uidParaUsar,
      }),
    };
  } catch (err) {
    console.error('❌ Erro buscar-agenda-publica:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};