// src/utils/log.js
/**
 * Wrapper de log seguro.
 *
 * - Em DEV: loga normalmente (ajuda a debugar)
 * - Em PROD: NÃO loga NADA (evita vazar dados sensíveis no console)
 *
 * Use estes em vez de console.log/console.warn em código de produção.
 */

export const log = (...args) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

export const logWarn = (...args) => {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
};

/**
 * console.error é SEMPRE logado — mesmo em produção.
 * Erros de verdade precisam aparecer pra você debugar em produção.
 * NUNCA passe dados sensíveis (nome, doc, senha) aqui.
 */
export const logError = (...args) => {
  console.error(...args);
};