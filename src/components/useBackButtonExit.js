// src/components/useBackButtonExit.js
import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Escuta o botão "voltar" do Android quando está rodando como APK.
 *
 * Comportamento:
 *  - Se o WebView tem histórico pra voltar (canGoBack = true) → volta normal.
 *  - Se NÃO tem (tela raiz) → chama `onTentarSair()`.
 *    Aí você mostra o modal "Deseja sair do app?".
 */
export function useBackButtonExit(onTentarSair) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener = null;
    let cancelado = false;

    const configurar = async () => {
      try {
        listener = await CapacitorApp.addListener(
          'backButton',
          ({ canGoBack }) => {
            if (cancelado) return;

            if (canGoBack) {
              window.history.back();
            } else {
              // Não tem mais pra onde voltar → pergunta se quer sair
              onTentarSair?.();
            }
          }
        );
      } catch (e) {
        console.warn('Falha ao escutar backButton:', e);
      }
    };

    configurar();

    return () => {
      cancelado = true;
      try { listener?.remove?.(); } catch {}
    };
  }, [onTentarSair]);
}

/**
 * Fecha o app de verdade (só funciona no APK).
 */
export async function fecharAppNativo() {
  try {
    if (Capacitor.isNativePlatform()) {
      await CapacitorApp.exitApp();
    }
  } catch (e) {
    console.warn('Falha ao fechar o app:', e);
  }
}