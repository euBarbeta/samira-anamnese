const CACHE_NAME = 'samira-estetica-v11';
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
/* ---------- RENOVAÇÃO AUTOMÁTICA DA SUBSCRIPTION ---------- */
/* ---------- RENOVAÇÃO AUTOMÁTICA DA SUBSCRIPTION ---------- */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const reg = self.registration;
        const oldSub = event.oldSubscription;
        const newSub = event.newSubscription || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: oldSub?.options?.applicationServerKey
        });

        const subJson = newSub.toJSON();

        // ✅ 1. Envia a nova subscription DIRETO para o backend
        //    (funciona mesmo se o app estiver fechado)
        const pacienteId = await reg.pushManager
          .getSubscription()
          .then(s => s && extractPacienteId(s));

        // Tenta descobrir o pacienteId via IndexedDB/localStorage gravado antes
        const pacienteIdSalvo = await getPacienteIdSalvo();

        if (pacienteIdSalvo) {
          await fetch('/.netlify/functions/atualizar-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pacienteId: pacienteIdSalvo,
              subscription: subJson
            })
          }).catch(() => {});
        }

        // ✅ 2. Também avisa janelas abertas (redundância)
        const clientList = await clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });
        clientList.forEach((client) => {
          client.postMessage({
            tipo: 'RESUBSCRIBE_PUSH',
            subscription: subJson
          });
        });
      } catch (e) {
        console.warn('Falha ao renovar subscription:', e);
      }
    })()
  );
});

// Helpers para o SW guardar o pacienteId localmente
async function getPacienteIdSalvo() {
  try {
    const cache = await caches.open('sw-paciente-id');
    const resp = await cache.match('/paciente-id');
    if (!resp) return null;
    return await resp.text();
  } catch (e) {
    return null;
  }
}

function extractPacienteId(subscription) {
  // não usamos mais, mantido por compatibilidade
  return null;
}

// ✅ Ouvir mensagem do app para guardar o pacienteId no CacheStorage
self.addEventListener('message', (event) => {
  if (event.data?.tipo === 'SALVAR_PACIENTE_ID' && event.data?.pacienteId) {
    event.waitUntil(
      caches.open('sw-paciente-id').then((cache) =>
        cache.put('/paciente-id', new Response(String(event.data.pacienteId)))
      )
    );
  }
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
    requireInteraction: false,          // ⬅️ mantém visível até interagir
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
    requireInteraction: false,           // ⬅️ também aqui
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

  // ✅ Qualquer clique (corpo ou botão "Ver ficha") abre a PASTA do paciente
  const urlDestino = new URL('/', self.location.origin);
  // NÃO adiciona ?abrir=anamnese → abre no detalhe_pasta por padrão

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Só foca, sem mandar mensagem — o app já está na pasta
          return client.focus();
        }
      }
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
