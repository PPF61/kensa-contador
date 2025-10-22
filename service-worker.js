// service-worker.js — Kensa Contador (offline-first, sem reload forçado)

// ⬇️ Aumente a versão quando trocar a lista de assets
const CACHE_VERSION = 'v5';
const CACHE_NAME = `contador-cache-${CACHE_VERSION}`;

// ⬇️ Ajuste NOME/PASTA dos ícones conforme seu repo
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './service-worker.js',
  './DS-DIGIT.woff2',
  './beep.mp3',
  './SOM DE ZEBRA-10.mp3',
  './pallet-complete.mp3',
  './completed.mp3',
  './icons-192.png',   // ↩︎ troque se o nome for diferente
  './icons-512.png'    // ↩︎ troque se o nome for diferente
];

// Pré-cache na instalação (sem skipWaiting para não forçar reload)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch((err) => {
        // Se algum asset falhar, não quebra a instalação inteira
        console.warn('[SW] Falha no addAll:', err);
      })
  );
});

// Ativar e limpar caches antigos com o mesmo prefixo
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('contador-cache-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      // Não chamamos clients.claim() para evitar refresh imediato.
      // O novo SW assume quando as abas forem abertas novamente.
    })()
  );
});

// Estratégias:
// - Navegação (requests de página): Network-first → fallback cache → fallback index.html
// - Estáticos do ASSETS: Cache-first
// - Outros GET same-origin: Stale-while-revalidate simples
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só lida com GET e mesma origem
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // 1) Navegação (endereços de página)
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          // Opcional: guarda no cache uma cópia do index se vier dele
          return net;
        } catch {
          // Sem rede → tenta cache do index e por fim um fallback simples
          const cache = await caches.open(CACHE_NAME);
          const cachedIndex = await cache.match('./index.html');
          return cachedIndex || new Response('<h1>Offline</h1>', {
            headers: { 'Content-Type': 'text/html; charset=UTF-8' }
          });
        }
      })()
    );
    return;
  }

  // 2) Se for um dos assets pré-cacheados → Cache-first
  const url = new URL(req.url);
  const pathname = url.pathname.startsWith('/') ? '.' + url.pathname : url.pathname;
  if (ASSETS.includes(pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const net = await fetch(req);
          // Atualiza cache
          cache.put(req, net.clone());
          return net;
        } catch {
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 3) Demais GET same-origin → Stale-while-revalidate simples
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const networkPromise = fetch(req)
        .then((res) => {
          // Evita cachear respostas opaque no mesmo host sem necessidade
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null);
      // Prioriza resposta rápida do cache; atualiza em background
      return cached || networkPromise || Response.error();
    })()
  );
});

// Opcional: permitir upgrade controlado (se um dia quiser forçar ativação via postMessage)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING_NOW') {
    self.skipWaiting();
  }
});
