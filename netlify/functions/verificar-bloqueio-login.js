// netlify/functions/verificar-bloqueio-login.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function hashEmail(email) {
  return crypto
    .createHash('sha256')
    .update(String(email).toLowerCase().trim())
    .digest('hex')
    .slice(0, 40);
}

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

    const { email } = JSON.parse(event.body || '{}');
    if (!email) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'email obrigatório' }) };
    }

    const emailHash = hashEmail(email);
    const bloqueioSnap = await db.collection('bloqueios_login').doc(emailHash).get();

    if (bloqueioSnap.exists) {
      const b = bloqueioSnap.data();
      if (b.bloqueado === true) {
        return {
          statusCode: 200,
          headers: CORS,
          body: JSON.stringify({
            bloqueado: true,
            motivo: b.motivo || 'Acesso suspenso',
            bloqueadoEm: b.bloqueadoEm,
          }),
        };
      }
    }

    // Não bloqueado pela esteta — checa se já passou do limite (aviso preventivo)
    const tentSnap = await db.collection('tentativas_login').doc(emailHash).get();
    const tent = tentSnap.exists ? tentSnap.data() : null;
    const JANELA = 15 * 60 * 1000;
    const agora = Date.now();
    const recentes = (tent?.tentativas || []).filter((t) => agora - t < JANELA);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        bloqueado: false,
        tentativasRecentes: recentes.length,
        aviso: recentes.length >= 3 ? 'Muitas tentativas recentes' : null,
      }),
    };
  } catch (err) {
    console.error('❌ Erro verificar-bloqueio-login:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};