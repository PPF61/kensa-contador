// Service Worker — Kensa Contador (v5) — com suporte a Range Requests (MP3 offline)
const CACHE_NAME = 'contador-cache-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './DS-DIGIT.woff2',
  './beep.mp3',
  './SOM DE ZEBRA-10.mp3',
  './pallet-complete.mp3',
  './completed.mp3',
  './service-worker.js'
];

// Instalação — cacheia todos os arquivos listados
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Ativação — remove caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Intercepta requisições
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const rangeHeader = req.headers.get('Range');

  // === 1️⃣ Trata Range Requests (MP3 / vídeo offline) ===
  if (rangeHeader) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      let res = await cache.match(req, { ignoreSearch: true });

      if (!res) {
        const url = new URL(req.url);
        const keys = await cache.keys();
        const hit = keys.find(k => new URL(k.url).pathname === url.pathname);
        if (hit) res = await cache.match(hit);
      }

      if (!res) {
        try { res = await fetch(req); } catch { /* offline sem cache */ }
      }
      if (!res) return new Response('', { status: 404 });

      const buf = await res.arrayBuffer();
      const size = buf.byteLength;

      const ranges = /bytes=(\d+)-(\d+)?/.exec(rangeHeader);
      const start = ranges && ranges[1] ? parseInt(ranges[1], 10) : 0;
      const end = ranges && ranges[2] ? parseInt(ranges[2], 10) : size - 1;
      const chunk = buf.slice(start, end + 1);

      const headers = new Headers(res.headers);
      headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Content-Length', chunk.byteLength);
      if (!headers.get('Content-Type')) headers.set('Content-Type', 'audio/mpeg');

      return new Response(chunk, { status: 206, statusText: 'Partial Content', headers });
    })());
    return;
  }

  // === 2️⃣ Cache-first para todo o resto ===
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const net = await fetch(req);
      if (req.method === 'GET' && net && net.ok) {
        cache.put(req, net.clone());
      }
      return net;
    } catch {
      if (req.mode === 'navigate') return cache.match('./');
      return new Response('', { status: 503 });
    }
  })());
});
