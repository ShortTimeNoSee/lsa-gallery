const CACHE = 'lsa-gallery-v3';
const ROOT = new URL('.', self.registration.scope).pathname;
const ASSETS = [
  '', 'index.html',
  'assets/style.css',
  'assets/app.js',
  'assets/logo.svg',
  'assets/manifest.webmanifest',
  'data/images.json'
].map(p => new URL(p, ROOT).pathname);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(e.request);
        if (res && res.ok) return res;
        return await caches.match(new URL('index.html', ROOT).pathname);
      } catch (_) {
        return await caches.match(new URL('index.html', ROOT).pathname);
      }
    })());
    return;
  }

  // Network first for manifest, cache-first for others
  if (url.pathname.endsWith('/data/images.json')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => cached))
  );
});
