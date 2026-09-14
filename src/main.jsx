import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
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

// console.error é SEMPRE mostrado (importante para produção)
export const logError = (...args) => {
  console.error(...args);
};


// ============================================================
// CAPTURA GLOBAL DO beforeinstallprompt
// Precisa rodar ANTES de qualquer componente montar, senão o
// evento dispara na tela de login e ninguém está ouvindo.
// ============================================================
window.__deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  // Impede o mini-infobar automático do Chrome
  e.preventDefault();
  // Guarda o evento globalmente para usar depois
  window.__deferredPrompt = e;
  log('✅ beforeinstallprompt capturado globalmente:', e);
});

window.addEventListener('appinstalled', () => {
  window.__deferredPrompt = null;
  
});

// ============================================================
// REGISTRO DO SERVICE WORKER
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        
      })
      .catch((error) => {
        console.error('Falha ao registrar o Service Worker:', error);
      });
  });
}

// ============================================================
// MONTAGEM DO APP
// ============================================================
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)