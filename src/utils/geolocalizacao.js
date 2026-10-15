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
 * Detecta o estado ATUAL do GPS.
 * Retorna APENAS:
 *   'ligado'         → GPS ligado E permissão concedida
 *   'gps_desligado'  → permissão concedida MAS GPS desligado
 *   'negada'         → permissão negada
 *   'prompt'         → ainda não pediu permissão
 */
export async function detectarEstadoGPS() {
  // ============================================================
  // APK: usa Capacitor
  // ============================================================
  if (isNativo()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const perm = await Geolocation.checkPermissions();

      // Mapeia permissões
      if (perm.location === 'denied') return 'negada';
      if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
        return 'prompt';
      }

      // granted → testa se o GPS responde (timeout generoso)
      try {
        await Promise.race([
          Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 30000,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('gps_desligado')), 9000)
          ),
        ]);
        return 'ligado';
      } catch (err) {
        const msg = (err?.message || '').toLowerCase();
        // Qualquer erro no getCurrentPosition = GPS desligado
        // (permissão já foi verificada como granted acima)
        if (
          msg.includes('location services') ||
          msg.includes('gps') ||
          msg.includes('disabled') ||
          msg.includes('unavailable') ||
          msg.includes('timeout') ||
          msg.includes('gps_desligado')
        ) {
          return 'gps_desligado';
        }
        return 'gps_desligado';
      }
    } catch (e) {
      console.warn('Falha detectarEstadoGPS nativo:', e);
      return 'gps_desligado';
    }
  }

  // ============================================================
  // Web/PWA
  // ============================================================
  if (!('geolocation' in navigator)) {
    return 'prompt';
  }

  let estadoPermissao = 'prompt';
  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      estadoPermissao = status.state;
    }
  } catch (e) {
    console.warn('Falha checando permissão web:', e);
  }

  if (estadoPermissao === 'denied') return 'negada';
  if (estadoPermissao === 'prompt') return 'prompt';

  // granted → testa GPS
  try {
    await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 30000,
      });
    });
    return 'ligado';
  } catch (err) {
    if (err.code === 1) return 'negada';
    // Qualquer outro erro = GPS desligado
    return 'gps_desligado';
  }
}

/**
 * Rótulo humano. Só retorna 4 valores possíveis.
 */
export function rotuloStatusLocalizacao(status) {
  return {
    ligado: '🟢 GPS ligado',
    ativa: '🟢 GPS ligado',
    gps_desligado: '⚠️ GPS desligado',
    negada: '⚠️ Localização negada',
    prompt: '⏳ Aguardando autorização',
  }[status] || '⚠️ GPS desligado';
}

/**
 * Cor do rótulo.
 */
export function corStatusLocalizacao(status) {
  return (status === 'ligado' || status === 'ativa') ? '#166534' : '#92400e';
}
