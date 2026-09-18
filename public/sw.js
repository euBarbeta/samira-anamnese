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
/* ---------- PUSH ---------- */
self.addEventListener('push', (event) => {
  let data = {
    title: 'Lembrete',
    body: 'Você tem um lembrete da Samira Estética',
    icon: '/imagens/pwa-192.png',
    badge: '/imagens/badge-72.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,          // ⬅️ mantém visível até interagir
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

  const tagFinal =
    data.tag ||
    `lembrete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: data.vibrate,
    tag: tagFinal,
    renotify: true,
    requireInteraction: true,           // ⬅️ também aqui
    silent: false,
    timestamp: data.timestamp,
    dir: data.dir,
    lang: data.lang,
    data: {
      url: data.url || '/',
      lembreteId: data.lembreteId || null
    },
    actions: [
      { action: 'abrir', title: '📖 Ver ficha' },
  
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // ✅ Só abre o app se foi o botão "Ver ficha" OU toque no corpo (action vazia)
  // Qualquer outro valor desconhecido → apenas fecha.
  if (event.action && event.action !== 'abrir') {
    return; // ação desconhecida, não faz nada
  }

  // Descobre a URL correta
  const urlDestino = new URL('/', self.location.origin);

  // Se veio do botão "abrir", vai direto pra anamnese
  if (event.action === 'abrir') {
    urlDestino.searchParams.set('abrir', 'anamnese');
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já tem janela aberta → foca e (se for o caso) navega pra anamnese
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (event.action === 'abrir') {
            try {
              client.postMessage({ tipo: 'ABRIR_ANAMNESE' });
            } catch (e) { /* ignora */ }
          }
          return client.focus();
        }
      }
      // Senão abre nova janela
      if (clients.openWindow) {
        return clients.openWindow(urlDestino.toString());
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