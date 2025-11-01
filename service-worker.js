// service-worker.js (v11) — offline forte + navegação + Range para MP3
const CACHE_NAME = 'contador-cache-v11';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',

  // Áudios — exatamente como no index.html
  './completed.mp3',
  './pallet-complete.mp3',
  './beep.mp3',
  './zebra-10.mp3',

  // Fonte/ícones (ajuste os nomes se forem outros no seu repo)
  './DS-DIGIT.woff2',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Request com {cache:'reload'} força baixar versão nova mesmo se houver HTTP cache
    await cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k === CACHE_NAME ? null : caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const rangeHeader = req.headers.get('range');

  // 1) Suporte a Range (mídia) — essencial para MP3 offline
  if (rangeHeader) {
    event.respondWith(handleRangeRequest(req, rangeHeader));
    return;
  }

  // 2) Navegações (abrir pelo ícone / reload de página): sempre garantir index do cache
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      // Tenta rede primeiro (quando online) para pegar atualizações…
      try {
        const fresh = await fetch(req);
        // …e guarda no cache para a próxima
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        // Offline: volta para o index do cache (SPA offline)
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match('./index.html');
        if (cachedIndex) return cachedIndex;
        // fallback: tenta raiz
        return cache.match('./') || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // 3) Demais requisicões: cache-first com atualização em background quando possível
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (req.method === 'GET' && res && res.status === 200) {
        const clone = res.clone();
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, clone);
      }
      return res;
    } catch {
      // Offline e sem cache para esse recurso: usa index como fallback mínimo
      return caches.match('./index.html');
    }
  })());
});

async function handleRangeRequest(req, rangeHeader) {
  const cache = await caches.open(CACHE_NAME);
  let cached = await cache.match(req);
  if (!cached) cached = await cache.match(new Request(req.url));
  if (!cached) {
    try { return await fetch(req); } catch {}
    return new Response('Offline', { status: 503 });
  }
  const blob = await cached.blob();
  const size = blob.size;

  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  let start = 0, end = size - 1;
  if (m) {
    if (m[1]) start = parseInt(m[1], 10);
    if (m[2]) end = parseInt(m[2], 10);
  }
  start = isNaN(start) ? 0 : Math.min(Math.max(0, start), size - 1);
  end   = isNaN(end)   ? size - 1 : Math.min(Math.max(start, end), size - 1);

  const sliced = blob.slice(start, end + 1);
  const headers = new Headers(cached.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Length', String(end - start + 1));
  if (!headers.get('Content-Type')) headers.set('Content-Type', 'audio/mpeg');

  return new Response(sliced, { status: 206, statusText: 'Partial Content', headers });
}
