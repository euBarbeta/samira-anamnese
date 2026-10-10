// netlify/functions/registrar-tentativa-login.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const LIMITE_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000; // 15 min

// Hash do email — nunca salvamos o email em claro
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

    const { email, sucesso = false, userAgent = '', plataforma = 'web' } = JSON.parse(event.body || '{}');
    if (!email) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'email obrigatório' }) };
    }

    const emailHash = hashEmail(email);
    const docRef = db.collection('tentativas_login').doc(emailHash);
    const agora = Date.now();

    const snap = await docRef.get();
    const dados = snap.exists ? snap.data() : null;
    const tentativas = (dados?.tentativas || []).filter((t) => agora - t < JANELA_MS);

    if (sucesso) {
      // Sucesso → limpa tentativas e registra o sucesso
      await docRef.set(
        {
          emailHash,
          tentativas: [],
          ultimoSucesso: new Date().toISOString(),
          ultimoDispositivo: userAgent.slice(0, 200),
          ultimaPlataforma: plataforma,
          atualizadoEm: new Date().toISOString(),
        },
        { merge: true }
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, limpo: true }) };
    }

    // Falha → adiciona ao array
    tentativas.push(agora);

    const bloqueado = tentativas.length >= LIMITE_TENTATIVAS;

    await docRef.set(
      {
        emailHash,
        tentativas,
        totalTentativas: tentativas.length,
        ultimaTentativa: new Date().toISOString(),
        ultimoDispositivo: userAgent.slice(0, 200),
        ultimaPlataforma: plataforma,
        requerBloqueio: bloqueado,
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );

    // Se estourou o limite, notifica a esteta (chama a function de notificação)
    if (bloqueado) {
      try {
        const baseUrl =
          process.env.URL ||
          process.env.DEPLOY_PRIME_URL ||
          `https://${event.headers.host}`;

        await fetch(`${baseUrl}/.netlify/functions/notificar-tentativa-suspeita`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailHash, totalTentativas: tentativas.length }),
        });
      } catch (e) {
        console.warn('Falha ao notificar tentativa suspeita:', e);
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, totalTentativas: tentativas.length, bloqueado }),
    };
  } catch (err) {
    console.error('❌ Erro registrar-tentativa-login:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};