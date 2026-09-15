importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
self.addEventListener('push', (event) => {
  console.log('🔥 PUSH RECEBIDO NO SW!', event);
  event.waitUntil(
    self.registration.showNotification('🔥 TESTE SW MANUAL', {
      body: 'O Service Worker recebeu um push!',
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