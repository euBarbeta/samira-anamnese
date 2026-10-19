// netlify/functions/limpar-subscription-anterior.js
//
// 🔒 Chamada pelo front quando alguém troca de conta no mesmo
//    navegador/aparelho. Limpa a subscription do "dono anterior".
//
// Antes o front escrevia direto no Firestore:
//   - Qualquer autenticado podia zerar a subscription de outro
//   - Atacante silenciava notificações de vítimas
//
// Agora valida:
//   1) Token Firebase válido
//   2) Não pode limpar o próprio slot (é "anterior", não "atual")
//   3) Não pode limpar slot inexistente (retorna ok/jaVazio)
//   4) Registra auditoria (limpoPor, subscriptionLimpaEm)

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

    // 🔒 1) Exige Firebase ID Token
    const authHeader =
      event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return {
        statusCode: 401,
        headers: CORS,
        body: JSON.stringify({ error: 'sem token' }),
      };
    }

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(token);
    } catch (e) {
      return {
        statusCode: 401,
        headers: CORS,
        body: JSON.stringify({ error: 'token inválido' }),
      };
    }

    const { role, idAnterior } = JSON.parse(event.body || '{}');

    if (!role || !idAnterior || !['paciente', 'esteticista'].includes(role)) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'dados inválidos' }),
      };
    }

    const uidChamador = decoded.uid;

    // 🔒 2) Não pode limpar o próprio slot
    if (String(idAnterior) === String(uidChamador)) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'não pode limpar o próprio slot' }),
      };
    }

    // ✅ 3) Coleção conforme o papel
    const colecao =
      role === 'esteticista'
        ? 'push_subscriptions_esteticistas'
        : 'push_subscriptions';

    const ref = db.collection(colecao).doc(String(idAnterior));
    const snap = await ref.get();

    if (!snap.exists) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ ok: true, jaVazio: true }),
      };
    }

    // ✅ 4) Limpa (com auditoria)
    await ref.update({
      subscription: null,
      subscriptionLimpaEm: new Date().toISOString(),
      limpoPor: uidChamador,
    });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('Erro limpar-subscription-anterior:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};