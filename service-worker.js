// Service Worker — Kensa Contador (v5.1) — cache normalizado + Range
const CACHE_NAME = 'contador-cache-v5.1';

// Liste seus assets base (sem e com "./")
const MP3S = [
  'beep.mp3',
  'SOM DE ZEBRA-10.mp3',
  'pallet-complete.mp3',
  'completed.mp3'
];

const BASE = [
  'index.html',
  'manifest.webmanifest',
  'DS-DIGIT.woff2',
  'service-worker.js' // opcional
];

// Gera variantes ('file' e './file') para evitar chave desigual no cache
function variants(paths){
  const out = new Set();
  paths.forEach(p => { out.add(p); out.add('./' + p); });
  return Array.from(out);
}

const ASSETS = variants([...BASE, ...MP3S, '']); // '' vira './' (raiz)

// ---------- install ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// ---------- activate ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Helper: normaliza URL para comparar no cache
function normPath(urlStr){
  const u = new URL(urlStr, self.registration.scope);
  // remove "./" inicial
  let p = u.pathname.replace(/^\.\//,'');
  // decodifica %20 -> espaço (para casarmos com entradas com espaço literal)
  try { p = decodeURIComponent(p); } catch {}
  return p;
}

// ---------- fetch ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const rangeHeader = req.headers.get('Range');

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Primeiro, tenta match direto
    let res = await cache.match(req, { ignoreSearch: true });
    if (!res) {
      // Tenta por caminho normalizado (com e sem "./")
      const reqPath = normPath(req.url);
      const keys = await cache.keys();
      const hitKey = keys.find(k => {
        const kp = normPath(k.url);
        return kp === reqPath;
      });
      if (hitKey) res = await cache.match(hitKey);
    }

    // Se ainda não achou, tenta rede (quando online) e guarda
    if (!res) {
      try {
        const net = await fetch(req);
        if (req.method === 'GET' && net && net.ok) {
          cache.put(req, net.clone());
        }
        res = net;
      } catch {
        // offline sem cache
      }
    }

    if (!res) {
      // fallback para SPA
      if (req.mode === 'navigate') return cache.match('./') || new Response('', {status: 503});
      return new Response('', { status: 404 });
    }

    // --- Tratamento de Range (áudio/vídeo) ---
    if (rangeHeader) {
      const buf = await res.arrayBuffer();
      const size = buf.byteLength;
      const m = /bytes=(\d+)-(\d+)?/.exec(rangeHeader) || [];
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : (size - 1);
      const chunk = buf.slice(start, end + 1);

      const headers = new Headers(res.headers);
      headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Content-Length', String(chunk.byteLength));
      if (!headers.get('Content-Type')) headers.set('Content-Type', 'audio/mpeg');

      return new Response(chunk, { status: 206, statusText: 'Partial Content', headers });
    }

    // Resposta normal (cache-first já feita acima)
    return res;
  })());
});
