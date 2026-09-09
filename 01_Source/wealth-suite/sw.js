const CACHE_NAME = 'wealth-suite-v1';
const ASSETS_TO_CACHE = [
  'index.html',
  'css/main.css',
  'js/data-model.js',
  'js/seed-data.js',
  'js/persistence.js',
  'js/list-controls.js',
  'js/company-calculations.js',
  'js/price-history.js',
  'js/paper-quotes.js',
  'js/paper-delivery.js',
  'js/modules/overview.js',
  'js/modules/fundamentals-csv.js',
  'js/modules/fundamentals.js',
  'js/modules/watchlist.js',
  'js/modules/portfolio.js',
  'js/modules/delivery-screener.js',
  'js/modules/paper-trading.js',
  'js/app.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});

