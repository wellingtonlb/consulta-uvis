const CACHE_NAME = 'uvis-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './dados.json',
  './Territorios_UBS.geojson',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/@turf/turf/turf.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Arquivos salvos no cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se tem no cache, retorna do cache (Offline!)
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});