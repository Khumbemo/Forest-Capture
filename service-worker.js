// Forest Capture — Service Worker v10
const CACHE_NAME = 'forest-capture-v33';
const ASSETS = [
  './index.html',
  './index.css',
  './src/main.js',
  './manifest.json',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './vendor/chartjs/chart.umd.min.js',
  './vendor/jspdf/jspdf.umd.min.js',
  './src/modules/i18n.js',
  './src/modules/ui.js',
  './src/modules/storage.js',
  './src/modules/firebase.js',
  './src/modules/ai.js',
  './src/modules/ai-knowledge.js',
  './src/modules/ai-offline-guide.js',
  './src/modules/ai-offline-llm.js',
  './src/modules/gps.js',
  './src/modules/weather.js',
  './src/modules/survey.js',
  './src/modules/symbols.js',
  './src/modules/map.js',
  './src/modules/map-offline.js',
  './src/modules/waypoints.js',
  './src/modules/quadrat.js',
  './src/modules/transect.js',
  './src/modules/environment.js',
  './src/modules/disturbance.js',
  './src/modules/media.js',
  './src/modules/notes.js',
  './src/modules/analytics.js',
  './src/modules/analytics-compare.js',
  './src/modules/export.js',
  './src/modules/herbarium.js',
  './src/modules/germplasm.js',
  './src/modules/germplasm-ui.js',
  './src/modules/backgrounds.js',
  './src/modules/prism.js',
  './src/modules/clinometer.js',
  './src/modules/compass.js',
  './src/modules/calculation.js',
  './src/modules/forest-capture-export.js',
  './src/modules/species-autocomplete.js',
  './src/modules/utils.js',
  './src/workers/analytics.worker.js'
];

// Third-party libraries still loaded from a CDN (see index.html). Their URLs
// are version-pinned, so a cached copy never goes stale: serve cache-first.
// Loaded as no-cors <script>s, so their responses are opaque (status 0).
const CDN_LIBS = [
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
];

async function cacheCdnLib(cache, url) {
  const response = await fetch(url, { mode: 'no-cors' });
  if (response.ok || response.type === 'opaque') await cache.put(url, response);
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Use allSettled so one failed asset doesn't break the entire SW install.
      const results = await Promise.allSettled([
        ...ASSETS.map(u => cache.add(u)),
        ...CDN_LIBS.map(u => cacheCdnLib(cache, u))
      ]);
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length) console.warn('SW: Failed to cache', failed.length, 'assets:', failed.map(r => r.reason));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

async function tileStrategy(request) {
  const cache = await caches.open('fc-v3-0-tiles');
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // Return a 1x1 transparent PNG when offline and tile not cached.
    return new Response(
      Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
        c => c.charCodeAt(0)),
      { headers: { 'Content-Type': 'image/png' } }
    );
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Never intercept blob URLs — these are file downloads (CSV, GPX, JSON, etc.)
  if (url.protocol === 'blob:') return;

  if (url.hostname === 'api.open-meteo.com') return;

  // Tile server requests — cache first
  const TILE_HOSTS = ['tile.openstreetmap.org', 'server.arcgisonline.com'];
  if (TILE_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(tileStrategy(event.request));
    return;
  }

  if (CDN_LIBS.includes(url.href)) {
    event.respondWith(caches.match(url.href).then(cached => cached || fetch(event.request).then(async response => {
      if (response.ok || response.type === 'opaque') (await caches.open(CACHE_NAME)).put(url.href, response.clone());
      return response;
    })));
    return;
  }

  // For app shell files: network-first (so updates show immediately)
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request).then(cached => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
