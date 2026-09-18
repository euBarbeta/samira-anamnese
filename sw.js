const CACHE_NAME = 'samira-estetica-v5';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/imagens/logo-samiramarcadagua.jpeg',
  '/imagens/logo-telainicial.jpeg',
  '/imagens/pwa-192.png',
  '/imagens/pwa-512.png'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
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

/* ---------- PUSH ---------- */
self.addEventListener('push', (event) => {
  console.log('🔔 Push recebido no SW:', event);

  let data = {
    title: 'Lembrete',
    body: 'Você tem um lembrete da Samira Estética',
    icon: '/imagens/pwa-192.png',
    badge: '/imagens/badge-72.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: false,
    silent: false,
    timestamp: Date.now(),
    dir: 'ltr',
    lang: 'pt-BR',
    url: '/'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  // ✅ TAG ÚNICA POR NOTIFICAÇÃO
  // Se o backend mandar 'tag', usa ela.
  // Senão, gera uma única com timestamp + random.
  const tagFinal =
    data.tag ||
    `lembrete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: data.vibrate,
    tag: tagFinal,                       // ⬅️ única!
    renotify: true,                       // notifica mesmo se for a mesma tag
    requireInteraction: data.requireInteraction,
    silent: data.silent,
    timestamp: data.timestamp,
    dir: data.dir,
    lang: data.lang,
    data: {
      url: data.url,
      lembreteId: data.lembreteId || null
    },
    actions: [
      { action: 'abrir', title: '📖 Ver ficha' },
      { action: 'fechar', title: 'Fechar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/* ---------- CLIQUE NA NOTIFICAÇÃO ---------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'fechar') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
/* ---------- FETCH (MANTIDO) ---------- */
const CACHEABLE_DESTINATIONS = ['image', 'style', 'script', 'font'];

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;
  if (request.url.includes('/@vite/') || request.url.includes('/__vite')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && CACHEABLE_DESTINATIONS.includes(request.destination)) {
          const clone = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          );
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || new Response('Offline', { status: 503 }))
      )
  );
});