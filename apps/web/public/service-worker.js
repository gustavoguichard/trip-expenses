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

const warmedUrlLimit = 200

async function warmRoutes(urls) {
  const cache = await caches.open(cacheName)
  const unique = [...new Set(urls)]
    .filter((url) => typeof url === 'string')
    .slice(0, warmedUrlLimit)
  await Promise.all(
    unique.map(async (url) => {
      try {
        const target = new URL(url, location.origin)
        if (target.origin !== location.origin) return
        const response = await fetch(target.href, {
          headers: { Accept: 'text/html' },
        })
        if (response.ok) await cache.put(target.href, response)
      } catch {}
    })
  )
}

self.addEventListener('message', (event) => {
  const { data } = event
  if (data?.type !== 'warm-routes' || !Array.isArray(data.urls)) return
  event.waitUntil(warmRoutes(data.urls))
})

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const tripSubPages = ['expenses/new', 'balances', 'charts', 'members', 'invite']

function shellFallbackShapes(pathname) {
  const match = pathname.match(new RegExp(`^/trips/(${uuid})(/.*)?$`, 'i'))
  if (!match) return []
  const [, tripId, rest = ''] = match
  if (rest === '') return [new RegExp(`^/trips/${uuid}$`, 'i')]
  if (new RegExp(`^/expenses/${uuid}$`, 'i').test(rest)) {
    return [
      new RegExp(`^/trips/${tripId}/expenses/new$`, 'i'),
      new RegExp(`^/trips/${uuid}/expenses/new$`, 'i'),
      new RegExp(`^/trips/${uuid}/expenses/${uuid}$`, 'i'),
    ]
  }
  const subPage = tripSubPages.find((candidate) => rest === `/${candidate}`)
  if (subPage) return [new RegExp(`^/trips/${uuid}/${subPage}$`, 'i')]
  return []
}

async function sameShapeShell(cache, url) {
  try {
    const shapes = shellFallbackShapes(url.pathname)
    if (shapes.length === 0) return undefined
    const keys = await cache.keys()
    for (const shape of shapes) {
      const key = keys.find((candidate) => {
        const pathname = new URL(candidate.url).pathname
        return pathname !== url.pathname && shape.test(pathname)
      })
      if (key) return await cache.match(key)
    }
  } catch {}
  return undefined
}

async function networkFirst(request) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    const borrowed = await sameShapeShell(cache, new URL(request.url))
    if (borrowed) return borrowed
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
