// netlify/functions/deletar-foto.js
const cloudinary = require('cloudinary').v2;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Configurar Cloudinary com as credenciais (env vars)
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });

    const { publicId } = JSON.parse(event.body || '{}');
    if (!publicId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'publicId obrigatório' }) };
    }

    const resultado = await cloudinary.uploader.destroy(publicId);
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, resultado }),
    };
  } catch (err) {
    console.error('❌ Erro ao deletar:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};