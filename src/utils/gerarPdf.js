// src/utils/gerarPdf.js
import html2pdf from 'html2pdf.js';

// ✅ Helper: baixa um Blob como arquivo
function baixarBlob(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ✅ Helper: verifica se o navegador suporta compartilhar arquivos
function suportaCompartilharArquivos() {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  );
}

/**
 * Gera o PDF e:
 *  - Se `compartilhar: true` e o navegador suportar → abre o menu "Abrir com..."
 *  - Senão → baixa o arquivo normalmente
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
      windowWidth: 794
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    // Pequeno delay pro DOM recalcular o layout com a classe .sendo-exportado
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (compartilhar && suportaCompartilharArquivos()) {
      // ── MODO COMPARTILHAR (mostra o menu "Abrir com...") ──
      const blob = await html2pdf()
        .from(elemento)
        .set(opcoesHtml2pdf)
        .outputPdf('blob');

      const file = new File([blob], nomeArquivo, { type: 'application/pdf' });

      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Ficha de Anamnese',
            text: `Ficha de ${nomeCliente || 'paciente'}`
          });
        } catch (err) {
          // Usuário cancelou → só ignora
          if (err.name === 'AbortError') {
            return true;
          }
          // Outro erro → cai pro download normal
          console.error('Erro no compartilhamento:', err);
          baixarBlob(blob, nomeArquivo);
        }
      } else {
        // Navegador suporta share mas não arquivos → baixa direto
        baixarBlob(blob, nomeArquivo);
      }
    } else {
      // ── MODO DOWNLOAD PADRÃO (desktop) ──
      await html2pdf()
        .from(elemento)
        .set(opcoesHtml2pdf)
        .save();
    }

    return true;
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    return false;
  } finally {
    elemento.style.width = larguraOriginal;
    elemento.style.maxWidth = maxWidthOriginal;
    document.body.classList.remove('sendo-exportado');
  }
};