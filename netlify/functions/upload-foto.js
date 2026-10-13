// netlify/functions/upload-foto.js
const cloudinary = require('cloudinary').v2;
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const busboy = require('busboy');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// ⚠️ Netlify limita body a 6MB — por isso o frontend DEVE comprimir antes.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  try {
    // 1) Inicializa Firebase Admin
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

    // 2) Exige Firebase ID Token
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

    // 3) Parse do multipart
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const pacIdRaw = event.queryStringParameters?.pacienteId;
    const estetaUidRaw = event.queryStringParameters?.uidEsteticista;

    if (!pacIdRaw || !estetaUidRaw) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'pacienteId e uidEsteticista obrigatórios' }) };
    }

    const pacienteId = String(pacIdRaw);
    const uidEsteticista = String(estetaUidRaw);

    // 4) Autorização: quem está enviando?
    //    - A própria esteta dona OU
    //    - O paciente dono do doc
    const ehEsteta = decoded.uid === uidEsteticista;
    const ehPaciente = decoded.uid === pacienteId;

    if (!ehEsteta && !ehPaciente) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'não autorizado' }) };
    }

    // 5) Parse do arquivo (multipart/form-data)
    const buffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'binary');

    const bb = busboy({ headers: { 'content-type': contentType } });
    let fileBuffer = null;
    let fileMime = null;

    await new Promise((resolve, reject) => {
      bb.on('file', (name, stream, info) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
          fileMime = info.mimeType;
        });
      });
      bb.on('finish', resolve);
      bb.on('error', reject);
      bb.end(buffer);
    });

    if (!fileBuffer) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'nenhum arquivo enviado' }) };
    }

    if (fileBuffer.length > 6 * 1024 * 1024) {
      return { statusCode: 413, headers: CORS, body: JSON.stringify({ error: 'arquivo muito grande (máx 6MB)' }) };
    }

    // 6) Configura Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });

    // 7) Upload via stream
    const resultado = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `samira/fotos/${pacienteId}`,
          context: `pacienteId=${pacienteId}`,
          resource_type: 'image',
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      uploadStream.end(fileBuffer);
    });

    // 8) Salva no Firestore
    const urlBase = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;

    const docRef = await db
      .collection(`usuarios/${uidEsteticista}/pacientes/${pacienteId}/fotos`)
      .add({
        url: `${urlBase}/q_auto,f_auto,w_1200/${resultado.public_id}.${resultado.format}`,
        thumbUrl: `${urlBase}/q_auto,f_auto,w_300,h_300,c_fill/${resultado.public_id}.${resultado.format}`,
        publicId: resultado.public_id,
        tamanho: fileBuffer.length,
        enviadoEm: new Date().toISOString(),
        enviadoPor: ehPaciente ? 'paciente' : 'esteticista',
        vinculadoA: [],
        notificado: false,
        uidEsteticista,
        pacienteNome: decoded.name || 'Paciente',
        pacienteId,
      });

    // 9) Notifica a esteticista (não bloqueia a resposta)
    if (ehPaciente) {
      try {
        const baseUrl = process.env.URL || `https://${event.headers.host}`;
        await fetch(`${baseUrl}/.netlify/functions/notificar-foto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uidEsteticista, pacienteId, pacienteNome: decoded.name || 'Paciente' }),
        });
      } catch (e) {
        console.warn('Falha ao notificar foto:', e);
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        id: docRef.id,
        url: `${urlBase}/q_auto,f_auto,w_1200/${resultado.public_id}.${resultado.format}`,
        thumbUrl: `${urlBase}/q_auto,f_auto,w_300,h_300,c_fill/${resultado.public_id}.${resultado.format}`,
        publicId: resultado.public_id,
      }),
    };
  } catch (err) {
    console.error('❌ Erro upload-foto:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};