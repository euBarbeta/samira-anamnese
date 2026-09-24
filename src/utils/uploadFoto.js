// src/utils/uploadFoto.js
import imageCompression from 'browser-image-compression';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const TIMEOUT_CANVAS_MS = 10000;   // reduzir com canvas
const TIMEOUT_COMPRESSAO_MS = 15000; // browser-image-compression
const TIMEOUT_UPLOAD_MS = 45000;   // fetch pro Cloudinary

/** Corrida: resolve com o valor OU rejeita após X ms */
function comTimeout(promise, ms, msgErro) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(msgErro)), ms)
    ),
  ]);
}

/**
 * ✅ Reduz a imagem via Canvas ANTES de qualquer coisa.
 * Isso é ordens de magnitude mais rápido que comprimir a foto original
 * (que no celular chega a 10MB+) — e evita matar o WebView.
 */
function reduzirComCanvas(file, maxDim = 1280, qualidade = 0.82) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        let { width, height } = img;

        // Se já é pequena, não mexe
        if (width <= maxDim && height <= maxDim) {
          URL.revokeObjectURL(url);
          resolve(file);
          return;
        }

        // Calcula proporção pra caber em maxDim × maxDim
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              // Fallback: se não conseguiu converter, usa o original
              resolve(file);
              return;
            }
            const novo = new File(
              [blob],
              (file.name || 'foto').replace(/\.\w+$/, '') + '.jpg',
              { type: 'image/jpeg' }
            );
            resolve(novo);
          },
          'image/jpeg',
          qualidade
        );
      } catch (e) {
        URL.revokeObjectURL(url);
        console.warn('Falha no canvas, usando original:', e);
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      console.warn('Falha ao carregar imagem, usando original');
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Comprime a imagem antes de enviar.
 * Pipeline: canvas (rápido) → browser-image-compression (leve refinamento).
 */
async function comprimirImagem(file) {
  // 1) Reduz com canvas (rápido, síncrono-ish)
  let reduzida;
  try {
    reduzida = await comTimeout(
      reduzirComCanvas(file, 1280, 0.82),
      TIMEOUT_CANVAS_MS,
      'Tempo esgotado ao reduzir a imagem'
    );
  } catch (e) {
    console.warn('Timeout no canvas, usando original:', e);
    reduzida = file;
  }

  // 2) Se já está pequena (< 700KB), nem chama o comprimidor
  if (reduzida.size < 700 * 1024) {
    return reduzida;
  }

  // 3) Refina com browser-image-compression (agora sobre uma imagem já pequena)
  try {
    const comprimida = await comTimeout(
      imageCompression(reduzida, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.8,
      }),
      TIMEOUT_COMPRESSAO_MS,
      'Tempo esgotado ao comprimir a imagem'
    );
    return comprimida;
  } catch (e) {
    console.warn('Falha ao comprimir, usando a reduzida:', e);
    return reduzida;
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

  const comprimida = await comprimirImagem(file);

  const formData = new FormData();
  formData.append('file', comprimida);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', `samira/fotos/${pacienteId}`);
  formData.append('context', `pacienteId=${pacienteId}`);

  // ✅ AbortController + timeout — evita ficar pendurado para sempre
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_UPLOAD_MS);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData, signal: controller.signal }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Falha no upload: ${err}`);
    }

    const data = await response.json();
    const urlBase = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;

    return {
      url: `${urlBase}/q_auto,f_auto,w_1200/${data.public_id}.${data.format}`,
      thumbUrl: `${urlBase}/q_auto,f_auto,w_300,h_300,c_fill/${data.public_id}.${data.format}`,
      publicId: data.public_id,
      tamanho: comprimida.size,
      largura: data.width,
      altura: data.height,
    };
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('O upload demorou demais. Tente uma foto menor.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Deleta uma foto do Cloudinary.
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