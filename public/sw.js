// Heirloom Kitchen Studio Service Worker - Offline Caching
const CACHE_NAME = 'heirloom-kitchen-cache-v7';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network first, falling back to cache for offline resilience
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass API calls, the Firebase auth handler, and anything cross-origin
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__/')
  ) {
    return;
  }

  // Built files have a hash in their name, so a cached copy is always the right one: serve it instantly.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
            }
            return networkResponse;
          })
      )
    );
    return;
  }

  // The page itself stays fresh (so new releases arrive), but a slow or missing connection falls back to the
  // saved copy after a couple of seconds instead of leaving a blank screen.
  event.respondWith(
    new Promise((resolve) => {
      let settled = false;
      const useCache = () =>
        caches.match(event.request).then((cached) => cached || (event.request.mode === 'navigate' ? caches.match('/') : undefined));
      const timer = setTimeout(() => {
        useCache().then((cached) => {
          if (cached && !settled) {
            settled = true;
            resolve(cached);
          }
        });
      }, event.request.mode === 'navigate' ? 2500 : 4000);
      fetch(event.request)
        .then((networkResponse) => {
          clearTimeout(timer);
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          if (!settled) {
            settled = true;
            resolve(networkResponse);
          }
        })
        .catch(() => {
          clearTimeout(timer);
          useCache().then((cached) => {
            if (!settled) {
              settled = true;
              resolve(cached || Response.error());
            }
          });
        });
    })
  );
});
