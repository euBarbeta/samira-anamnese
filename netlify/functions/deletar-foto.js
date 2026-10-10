// netlify/functions/deletar-foto.js
const cloudinary = require('cloudinary').v2;
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

    // 2) publicId do body
    const { publicId } = JSON.parse(event.body || '{}');
    if (!publicId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'publicId obrigatório' }) };
    }

    // 🔒 3) Procura a foto no Firestore (collectionGroup)
    //       e valida que o chamador é o dono
    const fotosSnap = await db.collectionGroup('fotos')
      .where('publicId', '==', publicId)
      .limit(1)
      .get();

    if (fotosSnap.empty) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'foto não encontrada' }) };
    }

    const fotoData = fotosSnap.docs[0].data();
    const callerUid = decoded.uid;

    const ehDono =
      fotoData.uidEsteticista === callerUid ||
      fotoData.pacienteId === callerUid;

    if (!ehDono) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'não autorizado' }) };
    }

    // 4) Configura Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });

    // 5) Deleta do Cloudinary
    const resultado = await cloudinary.uploader.destroy(publicId);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, resultado }),
    };
  } catch (err) {
    console.error('❌ Erro deletar-foto:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};