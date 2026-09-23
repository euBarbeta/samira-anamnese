// src/utils/gerarPdf.js
import html2pdf from 'html2pdf.js';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// ✅ Helper: verifica se está rodando no app nativo (APK)
function isNativo() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ✅ Helper (web): baixa um Blob como arquivo
function baixarBlobWeb(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ✅ Helper (web): verifica se o navegador suporta compartilhar arquivos
function suportaCompartilharWeb() {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  );
}

// ✅ Helper (nativo): converte Blob → base64 (sem o prefixo data:)
function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result; // "data:application/pdf;base64,JVBERi0..."
      const base64 = String(result).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ✅ Helper (nativo): salva o PDF e abre o menu "Abrir com..." / compartilhar
async function salvarEShareNativo(blob, nomeArquivo) {
  // 1) Converte pra base64
  const base64 = await blobParaBase64(blob);

  // 2) Salva na pasta de cache do app (não precisa de permissão)
  const resultado = await Filesystem.writeFile({
    path: nomeArquivo,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });

  // 3) Abre o menu nativo "Abrir com..." / "Compartilhar"
  await Share.share({
    title: 'Ficha em PDF',
    text: 'Escolha onde salvar ou abrir o PDF:',
    url: resultado.uri,
    dialogTitle: 'Abrir ou salvar PDF',
  });

  return resultado.uri;
}

/**
 * Gera o PDF e:
 *  - Nativo (APK): salva em cache + abre menu "Abrir com..."
 *  - Web com share disponível: abre menu "Compartilhar"
 *  - Web comum: baixa o arquivo normalmente
 */
export const exportarParaPDF = async (containerId, nomeCliente, opcoes = {}) => {
  const { compartilhar = false } = opcoes;

  const elemento = document.getElementById(containerId);
  if (!elemento) {
    alert('Conteúdo da ficha não encontrado para gerar o PDF.');
    return false;
  }

  document.body.classList.add('sendo-exportado');

  const larguraOriginal = elemento.style.width;
  const maxWidthOriginal = elemento.style.maxWidth;

  elemento.style.width = '210mm';
  elemento.style.maxWidth = 'none';

  const nomeArquivo = nomeCliente
    ? `Ficha_Anamnese_${nomeCliente.replace(/\s+/g, '_')}.pdf`
    : 'Ficha_Anamnese.pdf';

  const opcoesHtml2pdf = {
    margin: 0,
    filename: nomeArquivo,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      scrollY: 0,
      scrollX: 0,
      windowWidth: 794,
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  try {
    // Delay pro DOM recalcular o layout com a classe .sendo-exportado
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 🎯 SEMPRE gera como Blob (funciona em web e nativo)
    const blob = await html2pdf()
      .from(elemento)
      .set(opcoesHtml2pdf)
      .outputPdf('blob');

    // ============================================================
    // 1️⃣ APP NATIVO (APK) → Filesystem + Share
    // ============================================================
    if (isNativo()) {
      try {
        await salvarEShareNativo(blob, nomeArquivo);
        return true;
      } catch (err) {
        console.error('Erro ao salvar/compartilhar PDF nativo:', err);
        // Se o usuário cancelou o Share, não é erro de verdade
        if (err?.message?.toLowerCase().includes('cancel')) {
          return true;
        }
        alert('Não foi possível salvar o PDF. Tente novamente.');
        return false;
      }
    }

    // ============================================================
    // 2️⃣ WEB com compartilhamento de arquivos → Share API
    // ============================================================
    if (compartilhar && suportaCompartilharWeb()) {
      const file = new File([blob], nomeArquivo, { type: 'application/pdf' });

      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Ficha de Anamnese',
            text: `Ficha de ${nomeCliente || 'paciente'}`,
          });
          return true;
        } catch (err) {
          // Usuário cancelou → não faz nada
          if (err.name === 'AbortError') return true;
          // Outro erro → cai pro download padrão
          console.error('Erro no share web:', err);
          baixarBlobWeb(blob, nomeArquivo);
          return true;
        }
      } else {
        // Suporta share mas não arquivos
        baixarBlobWeb(blob, nomeArquivo);
        return true;
      }
    }

    // ============================================================
    // 3️⃣ WEB padrão (desktop) → download normal
    // ============================================================
    baixarBlobWeb(blob, nomeArquivo);
    return true;
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    alert('Erro ao gerar o PDF. Tente novamente.');
    return false;
  } finally {
    elemento.style.width = larguraOriginal;
    elemento.style.maxWidth = maxWidthOriginal;
    document.body.classList.remove('sendo-exportado');
  }
};