/* Service Worker — PFM (GitHub Pages) */
const VERSION = "pfm-v1.0.1";
const CORE = [
  './', './index.html',
  './dashboard.html','./ingresos.html','./gastos.html','./ahorros.html','./importar.html','./reportes.html',
  './offline.html',
  './css/style.css',
  './js/header.js','./js/pwa.js',
  './js/dashboard.v3.js','./js/ingresos.js','./js/gastos.js','./js/ahorros.js','./js/importar.js','./js/reportes.js',
  './manifest.webmanifest',
  './icons/icon-192.png','./icons/icon-512.png','./icons/maskable-192.png','./icons/maskable-512.png'
];

const urlFromScope = (path) => new URL(path, self.registration.scope).toString();

self.addEventListener('install', (evt) => {
  evt.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    try {
      await cache.addAll(CORE.map(urlFromScope));
    } catch (e) {
      // Si algo falla (algún archivo faltó), no rompas la instalación.
      console.warn('SW precache warning:', e);
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Navegación: cache-first con fallback a offline.html
// Estatícos mismo origen: cache-first
// Externos (CDN): stale-while-revalidate
self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    evt.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return cache.match(urlFromScope('./offline.html'));
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    evt.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return hit ?? Response.error();
      }
    })());
    return;
  }

  evt.respondWith((async () => {
    const runtime = await caches.open('rt-' + VERSION);
    const hit = await runtime.match(req);
    const net = fetch(req).then(r => { runtime.put(req, r.clone()); return r; }).catch(()=>null);
    return hit || net || Response.error();
  })());
});
