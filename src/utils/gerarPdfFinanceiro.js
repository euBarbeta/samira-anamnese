// src/utils/gerarPdfFinanceiro.js
/**
 * Gerador de PDF ISOLADO para o Relatório Financeiro.
 *
 * ⚠️ NÃO usa html2pdf.js — usa html2canvas + jsPDF direto com
 *    FATIAMENTO MANUAL em A4 (mesma técnica do gerarPdfHistorico).
 *
 * @param {HTMLElement} elemento - container DOM renderizado
 * @returns {Promise<Blob>}
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function isNativo() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      const base64 = String(result).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function aguardarRenderizacao(elemento) {
  await new Promise((r) => requestAnimationFrame(() => r()));
  await new Promise((r) => requestAnimationFrame(() => r()));

  const imagens = elemento.querySelectorAll('img');
  if (imagens.length > 0) {
    await Promise.all(
      Array.from(imagens).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );
  }

  await new Promise((r) => setTimeout(r, 250));
}

async function capturarCanvas(elemento) {
  const html2canvas = (await import('html2canvas')).default;

  const canvas = await html2canvas(elemento, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  return canvas;
}

async function montarPDF(canvas) {
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const imgData = canvas.toDataURL('image/jpeg', 0.85);

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf.output('blob');
}

/**
 * API principal — gera o PDF e devolve Blob.
 */
export async function gerarPdfFinanceiro(elemento) {
  if (!elemento) throw new Error('Container do PDF não encontrado.');

  await aguardarRenderizacao(elemento);
  const canvas = await capturarCanvas(elemento);
  const blob = await montarPDF(canvas);

  return blob;
}

/**
 * Salva/compartilha o PDF conforme a plataforma.
 */
export async function salvarPdfFinanceiro(blob, nomeArquivo) {
  if (isNativo()) {
    const base64 = await blobParaBase64(blob);
    const resultado = await Filesystem.writeFile({
      path: nomeArquivo,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });

    await Share.share({
      title: 'Salvar PDF',
      text: 'Escolha onde salvar o PDF:',
      url: resultado.uri,
      dialogTitle: 'Salvar PDF',
    });
    return;
  }

  // Web / PWA
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}