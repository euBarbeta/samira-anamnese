// netlify/functions/deletar-auth-paciente.js
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

    const { pacienteId } = JSON.parse(event.body || '{}');
    if (!pacienteId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Faltam dados' }) };
    }

    // Deleta a conta do paciente no Auth (se ela existir)
    // O catch silencioso garante que se a conta já não existir, não quebra o fluxo
    await getAuth().deleteUser(String(pacienteId)).catch(() => {});
    
    return { 
      statusCode: 200, 
      headers: CORS, 
      body: JSON.stringify({ ok: true }) 
    };
  } catch (err) {
    console.error('❌ Erro deletar-auth-paciente:', err);
    return { 
      statusCode: 500, 
      headers: CORS, 
      body: JSON.stringify({ error: err.message }) 
    };
  }
};