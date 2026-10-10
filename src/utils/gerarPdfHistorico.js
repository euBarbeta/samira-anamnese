// src/utils/gerarPdfHistorico.js
/**
 * Gerador de PDF ISOLADO para o Histórico de Agendamentos.
 *
 * ⚠️ NÃO usa html2pdf.js (que causa folha em branco).
 * Usa html2canvas + jsPDF direto, com FATIAMENTO MANUAL em A4.
 *
 * Vantagens:
 *  - Não gera página em branco
 *  - Cada página começa exatamente onde a anterior terminou
 *  - Funciona em web, PWA e APK
 *  - Retorna Blob pro caller decidir o que fazer
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

/**
 * Aguarda o layout estabilizar + imagens carregarem.
 * Sem isso, o html2canvas pode capturar "vazio" se rodar cedo demais.
 */
async function aguardarRenderizacao(elemento) {
  // 1) Espera 2 frames do navegador (layout pronto)
  await new Promise((r) => requestAnimationFrame(() => r()));
  await new Promise((r) => requestAnimationFrame(() => r()));

  // 2) Espera as imagens dentro do container (se houver)
  const imagens = elemento.querySelectorAll('img');
  if (imagens.length > 0) {
    await Promise.all(
      Array.from(imagens).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // falha também resolve
        });
      })
    );
  }

  // 3) Pequeno delay de segurança pro font-loading
  await new Promise((r) => setTimeout(r, 250));
}

/**
 * Captura o elemento como canvas via html2canvas.
 */
async function capturarCanvas(elemento) {
  const html2canvas = (await import('html2canvas')).default;

  const canvas = await html2canvas(elemento, {
    scale: 2, // qualidade retina
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    // ⚠️ NÃO passamos scrollX/scrollY — deixamos o html2canvas decidir
  });

  console.log('[PDF histórico] canvas capturado:', {
    width: canvas.width,
    height: canvas.height,
    ratio: (canvas.height / canvas.width).toFixed(2),
  });

  return canvas;
}

/**
 * Monta o PDF fatiando o canvas em páginas A4.
 *
 * Algoritmo clássico e à prova de folha em branco:
 *  - Desenha a imagem completa na 1ª página (em 0, 0).
 *  - Pra cada página seguinte, desenha a MESMA imagem, mas
 *    deslocada pra cima (position negativa) — mostrando a próxima fatia.
 *  - O jsPDF automaticamente corta o que passa da página.
 */
async function montarPDF(canvas) {
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();   // 210mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm

  // Largura da imagem = largura da página
  const imgWidth = pageWidth;

  // Altura proporcional à largura (mantém aspect ratio)
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  // ============================================================
  // 1ª PÁGINA
  // ============================================================
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  // ============================================================
  // PÁGINAS SEGUINTES
  // ============================================================
  while (heightLeft > 0) {
    // Desloca a imagem pra cima — mostra o trecho seguinte
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const totalPaginas = pdf.internal.getNumberOfPages();
  console.log(`[PDF histórico] PDF gerado — ${totalPaginas} página(s)`);

  return pdf.output('blob');
}

/**
 * API principal: gera o PDF e retorna um Blob.
 *
 * @param {HTMLElement} elemento - container DOM já renderizado
 * @returns {Promise<Blob>}
 */
export async function gerarPdfHistorico(elemento) {
  if (!elemento) throw new Error('Container do PDF não encontrado.');

  // 1) Espera renderização estabilizar
  await aguardarRenderizacao(elemento);

  // 2) Captura canvas
  const canvas = await capturarCanvas(elemento);

  // 3) Monta PDF
  const blob = await montarPDF(canvas);

  return blob;
}

/**
 * Salva/compartilha o Blob conforme a plataforma.
 * - Web/PWA: baixa direto
 * - APK: abre menu nativo "Salvar como"
 *
 * @param {Blob} blob
 * @param {string} nomeArquivo
 */
export async function salvarPdfHistorico(blob, nomeArquivo) {
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