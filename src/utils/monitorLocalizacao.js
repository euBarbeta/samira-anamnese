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
 * Monitor de localização em TEMPO REAL (5s).
 *
 * Dispara `onMudanca(novoEstado, estadoAnterior)` sempre que o
 * estado da localização MUDAR. Estados possíveis:
 *
 *   - 'ativa'          → GPS ligado e permissão concedida
 *   - 'gps_desligado'  → permissão OK, mas GPS off
 *   - 'negada'         → permissão negada
 *   - 'prompt'         → ainda não pediu permissão
 *   - 'nao_suportado'  → navegador sem suporte
 *   - 'timeout'        → GPS não respondeu
 *   - 'indisponivel'   → iOS sem distinção
 *
 * Também dispara em eventos nativos (appStateChange, visibilitychange)
 * e quando a permissão muda (permissions.onchange).
 *
 * Retorna uma função para parar o monitor.
 */
export function iniciarMonitorLocalizacao(onMudanca) {
  if (typeof window === 'undefined') return () => {};

  let cancelado = false;
  let statusPermissaoRef = null;
  let listenerAppState = null;
  let intervalId = null;
  let ultimoEstado = null;

  const verificarEComparar = async () => {
    if (cancelado) return;
    try {
      // Importa sob demanda (evita carregar libs se não usar)
      const { detectarEstadoGPS } = await import('./geolocalizacao');
      const novo = await detectarEstadoGPS();

      if (cancelado) return;

      // Só dispara se MUDOU (evita spam)
      if (novo !== ultimoEstado) {
        const anterior = ultimoEstado;
        ultimoEstado = novo;
        try {
          onMudanca?.(novo, anterior);
        } catch (e) {
          console.warn('Erro no onMudanca:', e);
        }
      }
    } catch (e) {
      console.warn('Erro verificando GPS:', e);
    }
  };

  // ============================================================
  // 1) App voltou pro foreground (APK)
  // ============================================================
  if (isNativo()) {
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        listenerAppState = await App.addListener('appStateChange', (state) => {
          if (state.isActive) verificarEComparar();
        });
      } catch (e) {
        console.warn('Falha registrando appStateChange:', e);
      }
    })();
  }

  // ============================================================
  // 2) PWA/Web → visibilitychange
  // ============================================================
  const onVisibility = () => {
    if (document.visibilityState === 'visible') verificarEComparar();
  };
  document.addEventListener('visibilitychange', onVisibility);

  // ============================================================
  // 3) Permissão mudou em tempo real
  // ============================================================
  if (navigator.permissions?.query) {
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelado) return;
        statusPermissaoRef = status;
        status.onchange = () => {
          if (cancelado) return;
          // Delay pro Android propagar o estado real
          setTimeout(verificarEComparar, 300);
        };
      })
      .catch(() => {});
  }

  // ============================================================
  // 4) Polling em TEMPO REAL — a cada 5s
  //    (enquanto o app está visível)
  // ============================================================
  intervalId = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    verificarEComparar();
  }, 5000);

  // ✅ Verifica uma vez na entrada
  verificarEComparar();

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