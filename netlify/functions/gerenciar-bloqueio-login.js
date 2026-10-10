// netlify/functions/gerenciar-bloqueio-login.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const UID_ESTETA_DONA = 'MZ5j3NpjlxY67yLRiEfg13TbPE32';

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

    // 🔒 Valida o token do Firebase Auth do cabeçalho
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (!token) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'sem token' }) };
    }

    const { getAuth } = require('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(token);

    if (decoded.uid !== UID_ESTETA_DONA) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'não autorizado' }) };
    }

    const { emailHash, acao, motivo = '' } = JSON.parse(event.body || '{}');
    if (!emailHash || !['bloquear', 'desbloquear'].includes(acao)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'dados inválidos' }) };
    }

    const ref = db.collection('bloqueios_login').doc(emailHash);

    if (acao === 'bloquear') {
      await ref.set(
        {
          emailHash,
          bloqueado: true,
          motivo: motivo.slice(0, 200),
          bloqueadoPor: decoded.uid,
          bloqueadoEm: new Date().toISOString(),
        },
        { merge: true }
      );
    } else {
      await ref.set(
        {
          emailHash,
          bloqueado: false,
          desbloqueadoPor: decoded.uid,
          desbloqueadoEm: new Date().toISOString(),
        },
        { merge: true }
      );

      // Limpa tentativas ao desbloquear
      await db.collection('tentativas_login').doc(emailHash).set(
        { tentativas: [], atualizadoEm: new Date().toISOString() },
        { merge: true }
      );
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, acao }) };
  } catch (err) {
    console.error('❌ Erro gerenciar-bloqueio-login:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};