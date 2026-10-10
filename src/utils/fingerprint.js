// src/utils/fingerprint.js
import { Capacitor } from '@capacitor/core';

/**
 * Gera um fingerprint simples e estável do dispositivo.
 * NÃO é à prova de balas — mas é bom o suficiente pra
 * detectar "o usuário trocou de celular" ou "trocou de navegador".
 */
export function gerarFingerprint() {
  try {
    const partes = [
      navigator.userAgent || '',
      navigator.language || '',
      String(screen.width || 0),
      String(screen.height || 0),
      String(new Date().getTimezoneOffset()),
      navigator.platform || '',
      Capacitor.isNativePlatform?.() ? 'native' : 'web',
    ];

    const base = partes.join('|');
    let hash = 0;
    for (let i = 0; i < base.length; i++) {
      hash = ((hash << 5) - hash) + base.charCodeAt(i);
      hash |= 0;
    }
    return 'fp_' + Math.abs(hash).toString(36);
  } catch {
    return 'fp_unknown';
  }
}

/**
 * Retorna um rótulo amigável do dispositivo.
 */
export function rotuloDispositivo() {
  const ua = navigator.userAgent || '';

  let navegador = 'Navegador';
  if (/Edg\//i.test(ua)) navegador = 'Edge';
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) navegador = 'Chrome';
  else if (/Firefox/i.test(ua)) navegador = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) navegador = 'Safari';

  let so = 'Desconhecido';
  if (/Android/i.test(ua)) so = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) so = 'iOS';
  else if (/Windows/i.test(ua)) so = 'Windows';
  else if (/Mac OS/i.test(ua)) so = 'macOS';
  else if (/Linux/i.test(ua)) so = 'Linux';

  const ehApp = Capacitor.isNativePlatform?.();
  if (ehApp) return `App nativo (${so})`;
  return `${navegador} em ${so}`;
}

/**
 * Retorna rótulo específico pra plataforma.
 */
export function plataformaAtual() {
  try {
    if (Capacitor.isNativePlatform?.()) return 'apk';
  } catch {}
  return 'pwa';
}