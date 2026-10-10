// netlify/functions/atualizar-subscription.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

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

    // 🔒 1) Exige Firebase ID Token
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'sem token' }) };
    }

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(token);
    } catch (e) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'token inválido' }) };
    }

    // 2) Body — aceita formato novo e antigo
    const body = JSON.parse(event.body || '{}');
    let role = body.role;
    let id = body.id;
    if (!role && body.pacienteId) {
      role = 'paciente';
      id = body.pacienteId;
    }
    const { subscription } = body;

    if (!role || !id || !subscription) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'dados incompletos' }) };
    }

    // 🔒 3) O UID do token PRECISA ser o mesmo do id
    //       (impede que alguém sobrescreva a subscription de outro)
    if (decoded.uid !== String(id)) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'não autorizado' }) };
    }

    // 4) Coleção e campo conforme o papel
    const colecao = role === 'esteticista' ? 'push_subscriptions_esteticistas' : 'push_subscriptions';
    const campoId = role === 'esteticista' ? 'uidEsteticista' : 'pacienteId';

    await db.collection(colecao).doc(String(id)).set(
      {
        [campoId]: String(id),
        subscription,
        plataforma: 'web',
        subscriptionAtualizadaEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, role, id }) };
  } catch (err) {
    console.error('❌ Erro atualizar-subscription:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};