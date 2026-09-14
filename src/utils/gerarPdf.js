// src/utils/gerarPdf.js
import html2pdf from 'html2pdf.js';

export const exportarParaPDF = (containerId, nomeCliente) => {
  const elemento = document.getElementById(containerId);
  if (!elemento) {
    alert('Conteúdo da ficha não encontrado para gerar o PDF.');
    return;
  }

  // 1. Adiciona a classe global para disparar os seletores de espelho no CSS
  document.body.classList.add('sendo-exportado');

  const larguraOriginal = elemento.style.width;
  const maxWidthOriginal = elemento.style.maxWidth;

  // Força a proporção ideal para A4
  elemento.style.width = '210mm';
  elemento.style.maxWidth = 'none';

  const nomeArquivo = nomeCliente 
    ? `Ficha_Anamnese_${nomeCliente.replace(/\s+/g, '_')}.pdf` 
    : 'Ficha_Anamnese.pdf';

  const opcoes = {
    margin:       0,
    filename:     nomeArquivo,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { 
      scale: 2,               
      useCORS: true, 
      letterRendering: true,
      scrollY: 0,
      scrollX: 0,
      windowWidth: 794 
    },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  // Pequeno timeout para garantir que o DOM recalculou o layout com a classe 'sendo-exportado'
  setTimeout(() => {
    html2pdf()
      .from(elemento)
      .set(opcoes)
      .save()
      .then(() => {
        elemento.style.width = larguraOriginal;
        elemento.style.maxWidth = maxWidthOriginal;
        document.body.classList.remove('sendo-exportado');
      })
      .catch(err => {
        console.error('Erro ao gerar PDF:', err);
        elemento.style.width = larguraOriginal;
        elemento.style.maxWidth = maxWidthOriginal;
        document.body.classList.remove('sendo-exportado');
      });
  }, 150);
};