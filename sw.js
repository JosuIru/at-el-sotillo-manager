/* ============================================================
   sw.js — Service Worker de AT El Sotillo Manager.
   Cachea el "app shell" para que la app funcione sin conexión.
   Estrategia: cache-first para los recursos propios; al cambiar de
   versión (VERSION) se limpian las cachés antiguas.
   ============================================================ */
const VERSION = 'elsotillo-v6';
const RECURSOS = [
  './',
  './index.html',
  './css/styles.css',
  './js/firebase-config.js',
  './js/util.js',
  './js/store.js',
  './js/model.js',
  './js/ui.js',
  './js/panel.js',
  './js/calendario.js',
  './js/reservas.js',
  './js/clientes.js',
  './js/limpieza.js',
  './js/estadisticas.js',
  './js/alojamientos.js',
  './js/ajustes.js',
  './js/airbnb-sync.js',
  './js/app.js',
  './js/sync-firebase.js',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(RECURSOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  // El calendario de Airbnb cambia cada hora: red primero, caché como respaldo.
  if (req.url.includes('/data/airbnb.json')) {
    evento.respondWith(
      fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          const copia = resp.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copia));
        }
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  evento.respondWith(
    caches.match(req).then((cacheada) => {
      if (cacheada) return cacheada;
      return fetch(req).then((resp) => {
        // Guardamos en caché las respuestas propias válidas para uso offline.
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copia = resp.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copia));
        }
        return resp;
      }).catch(() => cacheada);
    })
  );
});
