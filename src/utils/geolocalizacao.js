// src/utils/geolocalizacao.js
import { Capacitor } from '@capacitor/core';

function isNativo() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Pede localização e retorna:
 * {
 *   status: 'ativa' | 'negada' | 'gps_desligado' | 'nao_suportado' | 'timeout',
 *   lat, lng, cidade, pais
 * }
 *
 * NUNCA lança exceção — sempre retorna um objeto com status.
 */
export async function obterLocalizacao() {
  // 1) Navegador não suporta geolocalização?
  if (!('geolocation' in navigator) && !isNativo()) {
    return { status: 'nao_suportado' };
  }

  try {
    let posicao;

    if (isNativo()) {
      // APK — usa Capacitor
      const { Geolocation } = await import('@capacitor/geolocation');

      // Checa permissão primeiro
      let perm = await Geolocation.checkPermissions();

      if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
        perm = await Geolocation.requestPermissions();
      }

      if (perm.location === 'denied') {
        return { status: 'negada' };
      }

      // Timeout de 10s
      const timeoutPromise = new Promise((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), 10000)
      );

      posicao = await Promise.race([
        Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 9000,
          maximumAge: 60000,
        }),
        timeoutPromise,
      ]);
    } else {
      // Web / PWA
      if (navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          if (status.state === 'denied') {
            return { status: 'negada' };
          }
        } catch {}
      }

      posicao = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          (err) => {
            if (err.code === 1) reject(new Error('permission_denied'));
            else if (err.code === 2) reject(new Error('gps_off'));
            else reject(new Error('timeout'));
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      });
    }

    const lat = posicao.coords.latitude;
    const lng = posicao.coords.longitude;

    // Converte em cidade/país (OpenStreetMap — gratuito, sem API key)
    let cidade = null;
    let pais = null;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=pt-BR`,
        { headers: { 'User-Agent': 'SamiraEstetica/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        cidade = data.address?.city
          || data.address?.town
          || data.address?.village
          || data.address?.municipality
          || null;
        pais = data.address?.country_code?.toUpperCase() || null;
      }
    } catch (e) {
      console.warn('Nominatim falhou:', e);
    }

    return { status: 'ativa', lat, lng, cidade, pais };
  } catch (err) {
    const msg = String(err?.message || err).toLowerCase();

    if (msg.includes('permission') || msg.includes('denied')) {
      return { status: 'negada' };
    }
    if (msg.includes('gps') || msg.includes('location services') || msg.includes('posicion')) {
      return { status: 'gps_desligado' };
    }
    if (msg.includes('timeout')) {
      return { status: 'timeout' };
    }

    console.warn('Erro geolocalização:', err);
    return { status: 'nao_suportado' };
  }
}

/**
 * Retorna um rótulo legível pro status.
 */
export function rotuloStatusLocalizacao(status) {
  return {
    ativa: '✅ Ativa',
    negada: '⚠️ Negada pelo usuário',
    gps_desligado: '⚠️ GPS desligado',
    timeout: '⏱️ Tempo esgotado',
    nao_suportado: '⚠️ Não disponível',
  }[status] || '⚠️ Desconhecido';
}

/**
 * Retorna a cor do rótulo.
 */
export function corStatusLocalizacao(status) {
  return status === 'ativa' ? '#166534' : '#92400e';
}