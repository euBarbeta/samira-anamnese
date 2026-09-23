// src/utils/uploadFoto.js
import imageCompression from 'browser-image-compression';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Comprime a imagem antes de enviar (economiza banda e memória).
 */
async function comprimirImagem(file) {
  const options = {
    maxSizeMB: 0.5,          // máx 500KB depois da compressão
    maxWidthOrHeight: 1920,  // Full HD é suficiente
    useWebWorker: true,
    fileType: 'image/jpeg',
  };

  try {
    return await imageCompression(file, options);
  } catch (e) {
    console.warn('Falha ao comprimir, enviando original:', e);
    return file;
  }
}

/**
 * Faz upload para o Cloudinary.
 * Retorna { url, thumbUrl, publicId, tamanho }.
 */
export async function uploadFoto(file, pacienteId) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary não configurado (.env)');
  }

  // 1. Comprime
  const comprimida = await comprimirImagem(file);

  // 2. Prepara o FormData
  const formData = new FormData();
  formData.append('file', comprimida);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', `samira/fotos/${pacienteId}`);
  formData.append('context', `pacienteId=${pacienteId}`);

  // 3. Envia
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Falha no upload: ${err}`);
  }

  const data = await response.json();

  // 4. Monta URLs otimizadas (thumbnails e full)
  const urlBase = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;

  return {
    url: `${urlBase}/q_auto,f_auto,w_1200/${data.public_id}.${data.format}`,
    thumbUrl: `${urlBase}/q_auto,f_auto,w_300,h_300,c_fill/${data.public_id}.${data.format}`,
    publicId: data.public_id,
    tamanho: comprimida.size,
    largura: data.width,
    altura: data.height,
  };
}

/**
 * Deleta uma foto do Cloudinary (só funciona se tiver signed preset do backend).
 * Por segurança, essa operação será feita via Netlify Function.
 */
export async function deletarFotoCloudinary(publicId) {
  const response = await fetch('/.netlify/functions/deletar-foto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Falha ao deletar: ${err}`);
  }

  return response.json();
}