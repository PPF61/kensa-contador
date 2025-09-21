// Service Worker do Kensa Contador
// Versão 2 (inclui beep-10.mp3 no cache)

const CACHE_NAME = "contador-cache-v2";
const FILES_TO_CACHE = [
  "./",
  "./MYINDEX.html",       // usa o nome que você escolheu
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./DS-DIGIT.woff2",
  "./DS-DIGIT.TTF",
  "./beep.mp3",           // som de cada toque
  "./beep-10.mp3",        // som a cada 10 do C1
  "./pallet-complete.mp3" // som quando completa 60 (C2++)
];

// Instalação → adiciona arquivos ao cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// Ativação → limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch → responde do cache primeiro
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((resp) => resp || fetch(event.request))
  );
});
