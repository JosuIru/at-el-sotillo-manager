/* ============================================================
   sw.js — Service Worker de AT El Sotillo Manager.
   Cachea el "app shell" para que la app funcione sin conexión.
   Estrategia: red primero para el código (HTML/JS/CSS) con la caché como
   respaldo sin cobertura; caché primero para lo que no cambia (iconos,
   manifiesto). Al cambiar de versión (VERSION) se limpian las cachés antiguas.
   ============================================================ */
const VERSION = 'elsotillo-v9';
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

  // El código de la app (HTML, JS, CSS) va a RED PRIMERO, con la caché como
  // respaldo si no hay cobertura.
  //
  // Antes era caché primero para todo, y eso tenía un fallo grave: un móvil que
  // hubiera guardado una versión antigua se quedaba con ella indefinidamente, y
  // los arreglos publicados no le llegaban nunca. El resto de recursos (iconos,
  // manifiesto) sí siguen yendo a caché primero, porque no cambian.
  const esCodigo = /\.(html|js|css)$/.test(new URL(req.url).pathname)
    || req.mode === 'navigate'
    || new URL(req.url).pathname.endsWith('/');

  if (esCodigo) {
    evento.respondWith(
      fetch(req).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copia = resp.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copia));
        }
        return resp;
      }).catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
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
