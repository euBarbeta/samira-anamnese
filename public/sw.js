const CACHE_NAME = 'samira-estetica-v12';
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
        keys
          .filter((k) => k !== CACHE_NAME && k !== 'sw-push-context')
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/* ============================================================
   CONTEXTO PERSISTIDO — quem é o dono deste navegador
   Formato: { role: 'paciente' | 'esteticista', id: '<uid>' }
   ============================================================ */
async function getContextoSalvo() {
  try {
    const cache = await caches.open('sw-push-context');
    const resp = await cache.match('/context');
    if (!resp) return null;
    const txt = await resp.text();
    try {
      const parsed = JSON.parse(txt);
      if (parsed && parsed.role && parsed.id) return parsed;
    } catch {}
    // Compat: formato antigo era só o id (paciente)
    return { role: 'paciente', id: txt };
  } catch {
    return null;
  }
}

self.addEventListener('message', (event) => {
  const d = event.data || {};

  // Formato novo
  let ctx = null;
  if (d.role && d.id) {
    ctx = { role: d.role, id: String(d.id) };
  } else if (d.tipo === 'SALVAR_PACIENTE_ID' && d.pacienteId) {
    // Compat com a versão antiga
    ctx = { role: 'paciente', id: String(d.pacienteId) };
  }

  if (!ctx) return;

  event.waitUntil(
    caches.open('sw-push-context').then((cache) =>
      cache.put('/context', new Response(JSON.stringify(ctx)))
    )
  );
});

/* ---------- RENOVAÇÃO AUTOMÁTICA DA SUBSCRIPTION ---------- */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const reg = self.registration;
        const oldSub = event.oldSubscription;
        const newSub =
          event.newSubscription ||
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: oldSub?.options?.applicationServerKey,
          }));

        const subJson = newSub.toJSON();

        // ✅ 1. Descobre o contexto (paciente ou esteta)
        const ctx = await getContextoSalvo();

        if (ctx) {
          // ✅ 2. Envia pro backend unificado
          await fetch('/.netlify/functions/atualizar-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: ctx.role,
              id: ctx.id,
              subscription: subJson,
            }),
          }).catch(() => {});
        }

        // ✅ 3. Avisa janelas abertas (redundância)
        const clientList = await clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        clientList.forEach((client) => {
          client.postMessage({
            tipo: 'RESUBSCRIBE_PUSH',
            subscription: subJson,
            role: ctx?.role || null,
            id: ctx?.id || null,
          });
        });
      } catch (e) {
        console.warn('Falha ao renovar subscription:', e);
      }
    })()
  );
});

/* ---------- PUSH ---------- */
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
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
        url: '/',
      };

      if (event.data) {
        try {
          data = { ...data, ...event.data.json() };
        } catch (e) {
          data.body = event.data.text();
        }
      }

      // ✅ Deep-link automático:
      //    - Paciente → /#<pacienteId>
      //    - Esteta   → /#agendamentos  (ou outra rota definida no payload)
      //    Só sobrescreve se o payload NÃO trouxe url explícita.
      if (!data.url || data.url === '/') {
        const ctx = await getContextoSalvo();
        if (ctx?.role === 'paciente' && ctx.id) {
          data.url = `/#${ctx.id}`;
        }
        // Se for esteta, mantém '/' (painel já cai na lista)
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
        requireInteraction: false,
        silent: false,
        timestamp: data.timestamp,
        dir: data.dir,
        lang: data.lang,
        data: {
          url: data.url,
          lembreteId: data.lembreteId || null,
          tipo: data.tipo || null,
          agendamentoId: data.agendamentoId || null,
        },
        actions: [{ action: 'abrir', title: '📖 Ver ficha' }],
      };

      await self.registration.showNotification(data.title, options);
    })()
  );
});

/* ---------- CLICK ---------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // ✅ Usa a URL que foi calculada no push handler
  const destino = event.notification.data?.url || '/';
  const urlDestino = new URL(destino, self.location.origin);

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Foca uma aba já aberta na origem
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            // Se a URL desejada for diferente da atual, navega
            try {
              const clientUrl = new URL(client.url);
              if (
                clientUrl.pathname !== urlDestino.pathname ||
                clientUrl.hash !== urlDestino.hash
              ) {
                client.navigate(urlDestino.toString());
              }
            } catch {}
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlDestino.toString());
        }
      })
  );
});

/* ---------- FETCH ---------- */
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
        caches
          .match(request)
          .then((cached) => cached || new Response('Offline', { status: 503 }))
      )
  );
});