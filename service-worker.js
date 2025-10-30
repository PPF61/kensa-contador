// service-worker.js
// Cache-first para funcionar 100% offline, incluindo .mp3
const CACHE_NAME = 'contador-cache-v9'; // bump de versão ao alterar assets
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',

  // ÁUDIOS — mantidos como no index.html
  './completed.mp3',
  './pallet-complete.mp3',
  './beep.mp3',
  './zebra-10.mp3',

  // Fonte e ícones (ajuste os nomes se forem diferentes no seu repo)
  './DS-DIGIT.woff2',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k === CACHE_NAME ? null : caches.delete(k)));
    await self.clients.claim();
  })());
});

// Estratégia cache-first com fallback à rede
self.addEventListener('fetch', (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (req.method === 'GET' && res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
