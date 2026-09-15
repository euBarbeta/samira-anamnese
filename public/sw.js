importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
self.addEventListener('push', (event) => {
  console.log('🚨 PUSH RECEBIDO NO SW!', event.data?.text());
  event.waitUntil(
    self.registration.showNotification('🚨 PUSH CHEGOU NO SW', {
      body: 'Isso veio do OneSignal, não do DevTools!',
      icon: '/imagens/pwa-192.png'
    })
  );
});
const CACHE_NAME = 'samira-estetica-v4'; // ⬅️ suba esta versão a cada deploy
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/imagens/logo-samiramarcadagua.jpeg',
  '/imagens/logo-telainicial.jpeg',
  '/imagens/pwa-192.png',
  '/imagens/pwa-512.png'
];

// Tipos de recurso que vale a pena guardar em cache
const CACHEABLE_DESTINATIONS = ['image', 'style', 'script', 'font'];

/* ---------- INSTALL ---------- */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // allSettled: se um arquivo falhar, os outros continuam sendo cacheados
      Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
    )
  );
});

/* ---------- ACTIVATE ---------- */
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

/* ---------- FETCH ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Só lida com GET do próprio domínio
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  // Ignora requisições do Vite em dev (HMR, websocket, etc.)
  if (request.url.includes('/@vite/') || request.url.includes('/__vite')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Só cacheia respostas OK e de tipos estáticos
        if (response.ok && CACHEABLE_DESTINATIONS.includes(request.destination)) {
          const clone = response.clone();
          // ✅ waitUntil garante que o cache.put termine antes do SW dormir
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          );
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Fallback offline
          return new Response('Conexão perdida e nenhum cache encontrado.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain;charset=UTF-8' })
          });
        })
      )
  );
});