const CACHE = 'mca-lookup-v4';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  // cache:'reload' bypasses the browser HTTP cache so a new version can never
  // pre-cache a stale copy of the page (GitHub Pages sends max-age=600).
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))
  ));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // API calls: always network.
  if (req.url.includes('mirrormont.org/_functions')) {
    e.respondWith(fetch(req).catch(() => new Response('{"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // The page itself: network-first so updates show up immediately,
  // falling back to the cached copy when offline.
  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isPage) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('/index.html')))
    );
    return;
  }

  // Icons / manifest: cache-first.
  e.respondWith(caches.match(req).then(cached => cached || fetch(req)));
});
