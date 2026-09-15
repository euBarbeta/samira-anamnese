// 🧪 TESTE TEMPORÁRIO — capturar erro do importScripts
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
  console.log('✅ importScripts do OneSignal OK');
} catch (e) {
  console.error('❌ importScripts FALHOU:', e.message, e.stack);
}

// Listener de push manual (testado e funcionando)
self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('🔥 TESTE SW MANUAL', {
      body: 'Se você vê isso, o SW funciona',
      icon: '/imagens/pwa-192.png'
    })
  );
});
const CACHE_NAME = 'samira-estetica-v5';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/imagens/logo-samiramarcadagua.jpeg',
  '/imagens/logo-telainicial.jpeg',
  '/imagens/pwa-192.png',
  '/imagens/pwa-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ⚠️ NOTA: Removemos o listener 'fetch' customizado.
// O OneSignalSDK.sw.js já tem seu próprio handling.
// Adicionar o nosso pode causar conflito com o SW do SDK.