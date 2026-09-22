// Service Worker for Bina Enterprise PWA
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let browser handle normal network requests without interference
  event.respondWith(
    fetch(event.request).catch((err) => {
      // In offline scenario, return network error
      return Promise.reject(err);
    })
  );
});
