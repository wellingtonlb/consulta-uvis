 const CACHE_NAME = 'uvis-cache-v2'; 

const urlsToCache = [
  './',
  './index.html',
  './dados.json',
  './Territorios_UBS.geojson',
  './manifest.json',
  './icon.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/@turf/turf/turf.min.js'
];

 self.addEventListener('install', event => {
  self.skipWaiting(); // Força a ativação imediata
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('📦 PWA: Arquivos salvos no cache!');
      return cache.addAll(urlsToCache);
    })
  );
});

 self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🧹 PWA: Limpando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())  
  );
});

 self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
