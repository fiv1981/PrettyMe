const CACHE = 'prettyme-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './js/auth.js',
  './js/gallery.js',
  './js/api.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

const IMAGES_CACHE = 'prettyme-images-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== IMAGES_CACHE).map((k) => caches.delete(k)))));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls except image reads
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/images/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Image cache (cache-first for gallery images)
  if (url.pathname.startsWith('/api/images/')) {
    event.respondWith(
      caches.open(IMAGES_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request).then((response) => {
            cache.put(event.request, response.clone());
            return response;
          });
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // App shell (cache-first)
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});