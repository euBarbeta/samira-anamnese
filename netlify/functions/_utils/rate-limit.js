// netlify/functions/_utils/rate-limit.js

/**
 * Rate limiting simples em memória.
 * Cada deploy reinicia o estado — suficiente para bloquear abusos óbvios.
 *
 * ⚠️ IMPORTANTE — NÃO usar setInterval:
 *    O Netlify Functions roda em Lambda (AWS). Um `setInterval` ativo
 *    mantém o event loop vivo artificialmente, o que causa:
 *      - Cold start lento
 *      - Processo pendurado
 *      - Resposta 502 (Bad Gateway)
 *    Por isso, fazemos a limpeza SOB DEMANDA dentro do checkRateLimit.
 *
 * Uso:
 *   const { checkRateLimit } = require('./_utils/rate-limit');
 *   const rate = checkRateLimit('criar-agendamento', event, { max: 5, janela: 60000 });
 *   if (!rate.ok) return { statusCode: 429, body: 'Muitas requisições' };
 */

const memoria = new Map();

// ✅ Limpeza sob demanda: só roda quando o Map fica grande (> 100 entradas).
//    Não bloqueia o processo, não usa timers.
const LIMITE_ENTRADAS_ANTES_DE_LIMPAR = 100;
const TEMPO_EXPIRACAO_MS = 60 * 60 * 1000; // 1 hora

function limparEntradasAntigas() {
  const agora = Date.now();
  for (const [chave, dados] of memoria.entries()) {
    if (agora - dados.inicio > TEMPO_EXPIRACAO_MS) {
      memoria.delete(chave);
    }
  }
}

function obterIP(event) {
  return (
    event.headers['x-forwarded-for']?.split(',')[0].trim() ||
    event.headers['client-ip'] ||
    event.headers['x-nf-client-connection-ip'] ||
    'desconhecido'
  );
}

function checkRateLimit(prefixo, event, { max = 10, janela = 60000 } = {}) {
  // ✅ Limpa ANTES de adicionar — barato e não trava
  if (memoria.size > LIMITE_ENTRADAS_ANTES_DE_LIMPAR) {
    limparEntradasAntigas();
  }

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