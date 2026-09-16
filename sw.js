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

/* ---------- PUSH (NOVO) ---------- */
/* ---------- PUSH (MELHORADO) ---------- */
self.addEventListener('push', (event) => {
  console.log('🔔 Push recebido no SW:', event);

  let data = {
    title: 'Lembrete',
    body: 'Você tem um lembrete da Samira Estética',
    icon: '/imagens/pwa-192.png',
    badge: '/imagens/badge-72.png',       // ⬅️ NOVO: ícone pequeno monocromático
    image: '/imagens/notif-banner.jpg',   // ⬅️ NOVO: banner grande (Android/Desktop só)
    vibrate: [200, 100, 200, 100, 200],   // ⬅️ padrão mais "chamativo"
    tag: 'lembrete-samira',               // ⬅️ agrupa notificações (evita spam empilhado)
    renotify: true,                        // ⬅️ re-vibra/avisa se for mesma tag
    requireInteraction: false,             // ⬅️ true = fica na tela até o usuário fechar
    silent: false,                         // ⬅️ false = toca o "ding" do sistema
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

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    image: data.image,
    vibrate: data.vibrate,
    tag: data.tag,
    renotify: data.renotify,
    requireInteraction: data.requireInteraction,
    silent: data.silent,
    timestamp: data.timestamp,
    dir: data.dir,
    lang: data.lang,
    data: { url: data.url },
    // ⬇️ Botões de ação (SÓ funciona no Android e Desktop; iOS ignora)
    actions: [
      { action: 'abrir',   title: '📖 Ver ficha' },
      { action: 'fechar',  title: 'Fechar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/* ---------- CLIQUE NA NOTIFICAÇÃO (NOVO) ---------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Se clicou no botão "Fechar", só fecha
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