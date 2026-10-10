// src/utils/sanitizar.js

/**
 * Remove tags HTML, scripts, e caracteres de controle.
 * Use SEMPRE antes de salvar dados de usuário.
 */
export function sanitizarTexto(valor, opcoes = {}) {
  const { maxLength = 500, permitirQuebraLinha = false } = opcoes;

  if (valor == null) return '';

  let texto = String(valor);

  // 1) Remove null bytes e caracteres de controle (exceto \n e \t)
  texto = texto.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  // 2) Remove tags <script>, <style>, <iframe> inteiras
  texto = texto.replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '');
  texto = texto.replace(/<(script|style|iframe|object|embed)[^>]*\/?>/gi, '');

  // 3) Remove qualquer outra tag HTML
  texto = texto.replace(/<[^>]+>/g, '');

  // 4) Decodifica entidades comuns pra revalidar (&lt;script&gt;)
  texto = texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');

  // 5) Re-remove tags depois de decodificar (pega &lt;script&gt;)
  texto = texto.replace(/<[^>]+>/g, '');

  // 6) Remove "javascript:" em qualquer lugar
  texto = texto.replace(/javascript\s*:/gi, '');

  // 7) Remove "on*=" handlers inline
  texto = texto.replace(/\bon\w+\s*=/gi, '');

  // 8) Se NÃO permite quebra de linha, achata tudo
  if (!permitirQuebraLinha) {
    texto = texto.replace(/[\r\n]+/g, ' ');
  }

  // 9) Trim + limite de tamanho
  texto = texto.trim();
  if (texto.length > maxLength) {
    texto = texto.slice(0, maxLength);
  }

  return texto;
}

/**
 * Sanitiza e-mail: mantém só formato básico.
 */
export function sanitizarEmail(valor) {
  if (valor == null) return '';
  let texto = String(valor).trim().toLowerCase();
  texto = texto.replace(/[^a-z0-9@._+-]/g, '');
  if (texto.length > 254) texto = texto.slice(0, 254);
  return texto;
}

/**
 * Sanitiza telefone: mantém só dígitos e o prefixo internacional.
 */
export function sanitizarTelefone(valor) {
  if (valor == null) return '';
  let texto = String(valor).trim();
  texto = texto.replace(/[^\d+]/g, '');
  if (texto.length > 20) texto = texto.slice(0, 20);
  return texto;
}

/**
 * Sanitiza número de documento: mantém letras, números, pontos, traços.
 */
export function sanitizarDocumento(valor) {
  if (valor == null) return '';
  let texto = String(valor).trim();
  texto = texto.replace(/[^a-zA-Z0-9.\-/\s]/g, '');
  if (texto.length > 30) texto = texto.slice(0, 30);
  return texto;
}

/**
 * Sanitiza objeto inteiro de uma ficha de anamnese.
 */
export function sanitizarFichaAnamnese(ficha) {
  if (!ficha || typeof ficha !== 'object') return ficha;

  return {
    ...ficha,
    nome: sanitizarTexto(ficha.nome, { maxLength: 100 }),
    numeroDocumento: sanitizarDocumento(ficha.numeroDocumento),
    telefone: sanitizarTelefone(ficha.telefone),
    emailContato: sanitizarEmail(ficha.emailContato),
    endereco: sanitizarTexto(ficha.endereco, { maxLength: 200 }),
    observacoes: sanitizarTexto(ficha.observacoes, {
      maxLength: 5000,
      permitirQuebraLinha: true,
    }),
    // As respostas de radio/checkbox são chaves conhecidas — não sanitizar
    respostasRadio: ficha.respostasRadio || {},
    checkboxesAlt: ficha.checkboxesAlt || {},
    // Textos de hábitos podem ter entrada livre
    habitosTextos: Object.fromEntries(
      Object.entries(ficha.habitosTextos || {}).map(([k, v]) => [
        k,
        sanitizarTexto(v, { maxLength: 500 }),
      ])
    ),
  };
}