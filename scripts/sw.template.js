// Offline service worker. Written to dist/sw.js by the Vite plugin in
// scripts/vite-plugin-service-worker.ts, which
// fills in the cache version and the list of files to precache.
const CACHE = 'mtg-life-__VERSION__'
const PRECACHE = __PRECACHE__

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return

  // Navigations: network first so a new deploy shows up, falling back to the
  // cached shell when offline (the usual case at a game store).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone()
          caches.open(CACHE).then(cache => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Hashed assets: cache first.
  event.respondWith(caches.match(request).then(cached => cached ?? fetch(request)))
})
