// src/utils/dispositivos.js
import { Capacitor } from '@capacitor/core';

/**
 * Gera um fingerprint ESTÁVEL do dispositivo.
 *
 * Diferente do `fingerprint.js` (que inclui timezone e pode mudar
 * quando o usuário viaja), este aqui foca em características que
 * NÃO mudam com facilidade:
 *  - User-Agent normalizado (versão removida)
 *  - Plataforma (Android / iOS / Windows / Mac / Linux)
 *  - Plataforma nativa (APK vs PWA vs Web)
 *  - Faixa de resolução (arredondada)
 *
 * ⚠️ Isso NÃO é 100% à prova de troca. Se o usuário atualizar o
 *    Chrome (muda versão do UA), o fingerprint muda. Por isso
 *    removemos a versão do UA.
 */
export function gerarFingerprintEstavel() {
  try {
    const ua = (navigator.userAgent || '').toLowerCase();

    // Normaliza UA: remove versões (ex: chrome/120.0.1.2 → chrome)
    const uaNormalizado = ua
      .replace(/[\d.]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Detecta plataforma
    let plataforma = 'desconhecido';
    if (/android/i.test(ua)) plataforma = 'android';
    else if (/iphone|ipad|ipod/i.test(ua)) plataforma = 'ios';
    else if (/windows/i.test(ua)) plataforma = 'windows';
    else if (/mac os/i.test(ua)) plataforma = 'macos';
    else if (/linux/i.test(ua)) plataforma = 'linux';

    // Faixa de resolução (arredonda pra baixo em múltiplos de 100)
    const largura = Math.floor((screen.width || 0) / 100) * 100;
    const altura = Math.floor((screen.height || 0) / 100) * 100;

    // Plataforma nativa
    let runtime = 'web';
    try {
      if (Capacitor.isNativePlatform?.()) runtime = 'apk';
      else if (window.matchMedia('(display-mode: standalone)').matches) runtime = 'pwa';
    } catch {}

    const base = `${uaNormalizado}|${plataforma}|${largura}x${altura}|${runtime}`;

    // Hash determinístico (FNV-1a simplificado)
    let hash = 2166136261;
    for (let i = 0; i < base.length; i++) {
      hash ^= base.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }

    return `dev_${hash.toString(36)}`;
  } catch {
    return 'dev_unknown';
  }
}

/**
 * Chave única pra o doc em dispositivos_autorizados.
 * Formato: {pacienteId}__{fingerprint}
 */
export function chaveDispositivo(pacienteId, fingerprint) {
  return `${String(pacienteId)}__${fingerprint}`;
}

/**
 * Retorna um rótulo curto pro device.
 */
export function rotuloDispositivoCurto() {
  const ua = navigator.userAgent || '';

  let nav = 'Navegador';
  if (/Edg\//i.test(ua)) nav = 'Edge';
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) nav = 'Chrome';
  else if (/Firefox/i.test(ua)) nav = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) nav = 'Safari';

  let so = '';
  if (/Android/i.test(ua)) so = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) so = 'iOS';
  else if (/Windows/i.test(ua)) so = 'Windows';
  else if (/Mac OS/i.test(ua)) so = 'macOS';
  else if (/Linux/i.test(ua)) so = 'Linux';

  try {
    if (Capacitor.isNativePlatform?.()) return `App nativo (${so})`;
  } catch {}

  return so ? `${nav} em ${so}` : nav;
}