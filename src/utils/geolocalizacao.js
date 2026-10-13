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
 * ✅ NOVO: Detecta o estado ATUAL do GPS (ligado/desligado) SEM pedir permissão.
 *
 * Retorna:
 *   'ligado'        → permissão granted e GPS responde
 *   'gps_desligado' → permissão granted mas GPS retorna erro 2 (POSITION_UNAVAILABLE)
 *   'negada'        → permissão denied
 *   'prompt'        → ainda não pediu permissão
 *   'indisponivel'  → iOS sem distinção, ou navegador sem suporte
 */
export async function detectarEstadoGPS() {
  if (!('geolocation' in navigator) && !isNativo()) {
    return 'indisponivel';
  }

  // 1) Checa permissão primeiro
  let estadoPermissao = 'prompt';
  try {
    if (isNativo()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const perm = await Geolocation.checkPermissions();
      estadoPermissao = perm.location;
    } else if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      estadoPermissao = status.state;
    }
  } catch (e) {
    console.warn('Falha checando permissão:', e);
  }

  if (estadoPermissao === 'denied') return 'negada';
  if (estadoPermissao === 'prompt') return 'prompt';

  // 2) Permissão granted → testa se GPS está ligado (timeout curto)
  try {
    await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 0 }
      );
    });
    return 'ligado';
  } catch (err) {
    if (err.code === 2) return 'gps_desligado'; // POSITION_UNAVAILABLE
    if (err.code === 1) return 'negada';
    if (err.code === 3) return 'timeout';

    // iOS: sempre cai aqui quando GPS desligado — não dá pra distinguir
    return 'indisponivel';
  }
}

/**
 * ✅ NOVO: Monitora a localização em tempo real.
 *
 * Chama `onUpdate(posicao)` toda vez que o GPS muda.
 * Retorna uma função pra parar o monitoramento.
 *
 * ⚠️ Só funciona se a permissão já estiver concedida.
 */
export function monitorarLocalizacao(onUpdate, onError) {
  if (!('geolocation' in navigator) && !isNativo()) {
    onError?.('nao_suportado');
    return () => {};
  }

  if (isNativo()) {
    // Capacitor também tem watchPosition
    let watchId = null;
    let parado = false;

    (async () => {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        const perm = await Geolocation.checkPermissions();

        if (perm.location !== 'granted') {
          onError?.('negada');
          return;
        }

        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: false, timeout: 15000 },
          (pos, err) => {
            if (parado) return;
            if (err) {
              onError?.(err.code === 2 ? 'gps_desligado' : 'timeout');
              return;
            }
            if (pos) {
              onUpdate?.({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              });
            }
          }
        );
      } catch (e) {
        onError?.('nao_suportado');
      }
    })();

    return () => {
      parado = true;
      if (watchId) {
        import('@capacitor/geolocation').then(({ Geolocation }) => {
          Geolocation.clearWatch({ id: watchId }).catch(() => {});
        });
      }
    };
  }

  // Web / PWA
  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      onUpdate?.({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    },
    (err) => {
      if (err.code === 2) onError?.('gps_desligado');
      else if (err.code === 1) onError?.('negada');
      else onError?.('timeout');
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

/**
 * ✅ NOVO: Escuta mudanças no estado da PERMISSÃO (não do GPS).
 * Útil pra saber quando o usuário autoriza/nega em tempo real.
 */
export function escutarMudancaPermissao(callback) {
  if (!navigator.permissions?.query) return () => {};

  let statusRef = null;
  let cancelado = false;

  navigator.permissions.query({ name: 'geolocation' }).then((status) => {
    if (cancelado) return;
    statusRef = status;
    status.onchange = () => callback?.(status.state);
  }).catch(() => {});

  return () => {
    cancelado = true;
    if (statusRef) statusRef.onchange = null;
  };
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
    indisponivel: '⚠️ Indisponível',
    ligado: '🟢 GPS ligado',
    prompt: '⏳ Aguardando autorização',
  }[status] || '⚠️ Desconhecido';
}

/**
 * Retorna a cor do rótulo.
 */
export function corStatusLocalizacao(status) {
  return (status === 'ativa' || status === 'ligado') ? '#166534' : '#92400e';
}