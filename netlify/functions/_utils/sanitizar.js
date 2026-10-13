// netlify/functions/_utils/sanitizar.js

function sanitizarTexto(valor, { maxLength = 500, permitirQuebraLinha = false } = {}) {
  if (valor == null) return '';
  let texto = String(valor);

  // Remove null bytes e controles
  texto = texto.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  // Remove tags perigosas
  texto = texto.replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '');
  texto = texto.replace(/<[^>]+>/g, '');

  // Remove javascript: e handlers inline
  texto = texto.replace(/javascript\s*:/gi, '');
  texto = texto.replace(/\bon\w+\s*=/gi, '');

  if (!permitirQuebraLinha) {
    texto = texto.replace(/[\r\n]+/g, ' ');
  }

  texto = texto.trim();
  if (texto.length > maxLength) texto = texto.slice(0, maxLength);
  return texto;
}

function sanitizarEmail(valor) {
  if (valor == null) return '';
  let t = String(valor).trim().toLowerCase();
  t = t.replace(/[^a-z0-9@._+-]/g, '');
  return t.slice(0, 254);
}
