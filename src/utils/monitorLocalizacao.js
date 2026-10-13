// src/utils/monitorLocalizacao.js
import { Capacitor } from '@capacitor/core';

function isNativo() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Inicia um monitor de localização que revalida o estado quando:
 *  1) O app volta pro foreground (appStateChange no APK / visibilitychange no PWA)
 *  2) A PERMISSÃO muda em tempo real (permissions.onchange)
 *  3) Fallback: a cada 60s enquanto o app está aberto
 *
 * Chama `onRevalidar()` toda vez que um desses gatilhos dispara.
 *
 * Retorna uma função para parar o monitor.
 */
export function iniciarMonitorLocalizacao(onRevalidar) {
  if (typeof window === 'undefined') return () => {};

  let cancelado = false;
  let statusPermissaoRef = null;
  let listenerAppState = null;
  let intervalId = null;

  const disparar = () => {
    if (cancelado) return;
    try {
      onRevalidar?.();
    } catch (e) {
      console.warn('Erro no onRevalidar:', e);
    }
  };

  // ============================================================
  // 1) App voltou pro foreground
  // ============================================================
  // APK → App.addListener('appStateChange')
  if (isNativo()) {
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        listenerAppState = await App.addListener('appStateChange', (state) => {
          if (state.isActive) disparar();
        });
      } catch (e) {
        console.warn('Falha registrando appStateChange:', e);
      }
    })();
  }

  // PWA/Web → visibilitychange (funciona sempre, inclusive dentro do APK)
  const onVisibility = () => {
    if (document.visibilityState === 'visible') disparar();
  };
  document.addEventListener('visibilitychange', onVisibility);

  // ============================================================
  // 2) Permissão mudou em tempo real (PWA principalmente)
  // ============================================================
  if (navigator.permissions?.query) {
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelado) return;
        statusPermissaoRef = status;

        status.onchange = () => {
          if (cancelado) return;
          // Pequeno delay pro Android propagar o estado real
          setTimeout(disparar, 300);
        };
      })
      .catch(() => {});
  }

  // ============================================================
  // 3) Fallback — polling a cada 60s (só enquanto visível)
  // ============================================================
  intervalId = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    disparar();
  }, 60000);

  // ✅ Já dispara uma vez na entrada
  disparar();

  return () => {
    cancelado = true;

    try {
      document.removeEventListener('visibilitychange', onVisibility);
    } catch {}

    if (statusPermissaoRef) {
      try { statusPermissaoRef.onchange = null; } catch {}
    }

    if (listenerAppState) {
      try { listenerAppState.remove?.(); } catch {}
    }

    if (intervalId) clearInterval(intervalId);
  };
}