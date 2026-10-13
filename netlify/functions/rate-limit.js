// netlify/functions/_utils/rate-limit.js

/**
 * Rate limiting simples em memória.
 * Cada deploy reinicia o estado — suficiente para bloquear abusos óbvios.
 *
 * Uso:
 *   const { checkRateLimit } = require('./_utils/rate-limit');
 *   const ok = checkRateLimit('criar-agendamento', event, { max: 5, janela: 60000 });
 *   if (!ok) return { statusCode: 429, body: 'Muitas requisições' };
 */

const memoria = new Map();

// Limpa entradas antigas a cada 5 minutos para não vazar memória
setInterval(() => {
  const agora = Date.now();
  for (const [chave, dados] of memoria.entries()) {
    if (agora - dados.inicio > 3600000) memoria.delete(chave);
  }
}, 5 * 60 * 1000);

function obterIP(event) {
  return (
    event.headers['x-forwarded-for']?.split(',')[0].trim() ||
    event.headers['client-ip'] ||
    event.headers['x-nf-client-connection-ip'] ||
    'desconhecido'
  );
}

function checkRateLimit(prefixo, event, { max = 10, janela = 60000 } = {}) {
  const ip = obterIP(event);
  const chave = `${prefixo}:${ip}`;
  const agora = Date.now();

  const existente = memoria.get(chave);

  if (!existente || agora - existente.inicio > janela) {
    memoria.set(chave, { inicio: agora, contagem: 1 });
    return { ok: true, restante: max - 1 };
  }

  existente.contagem++;
  if (existente.contagem > max) {
    return {
      ok: false,
      restante: 0,
      retryAfter: Math.ceil((existente.inicio + janela - agora) / 1000),
    };
  }

  return { ok: true, restante: max - existente.contagem };
}

module.exports = { checkRateLimit };