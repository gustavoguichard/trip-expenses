const buildVersion = '__BUILD_VERSION__'
const version = buildVersion.startsWith('__') ? 'dev' : buildVersion
const cacheName = `trip-expenses-${version}`

const precachedPaths = [
  '/',
  '/styles.css',
  '/fonts/inter-variable.woff2',
  '/fonts/jetbrains-mono-variable.woff2',
  '/favicon.svg',
  '/manifest.webmanifest',
]

const revalidatedPathPrefixes = ['/assets/', '/styles.css']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.addAll(precachedPaths))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== cacheName)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

async function networkFirst(request) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    const shell = await cache.match('/')
    if (shell) return shell
    throw error
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(event.request)
  const refresh = fetch(event.request).then((response) => {
    if (response.ok) cache.put(event.request, response.clone())
    return response
  })
  if (!cached) return refresh
  event.waitUntil(refresh.catch(() => {}))
  return cached
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return
  const wantsHtml =
    request.mode === 'navigate' ||
    (request.headers.get('accept') ?? '').includes('text/html')
  if (wantsHtml) {
    event.respondWith(networkFirst(request))
    return
  }
  if (url.pathname.startsWith('/fonts/')) {
    event.respondWith(cacheFirst(request))
    return
  }
  if (
    revalidatedPathPrefixes.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    event.respondWith(staleWhileRevalidate(event))
  }
})
