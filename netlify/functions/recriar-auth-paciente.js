const { initializeApp, cert, getApps } = require('firebase-admin/app');
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
    
    const body = JSON.parse(event.body || '{}');
    const { uid, email, password } = body;

    if (!uid || !email || !password) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Faltam dados' }) };
    }

    // ✅ Cria o usuário no Auth com o UID EXATO (se ele já existir, o Firebase dá erro, então tentamos atualizar a senha)
    try {
      await getAuth().createUser({
        uid: uid,
        email: email,
        password: password,
        emailVerified: true,
      });
    } catch (err) {
      if (err.code === 'auth/uid-already-exists' || err.code === 'auth/email-already-exists') {
        // Se já existe, apenas atualiza a senha para garantir
        await getAuth().updateUser(uid, { password: password });
      } else {
        throw err;
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, uid }),
    };
  } catch (err) {
    console.error('❌ Erro recriar-auth:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};