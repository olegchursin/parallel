/// <reference lib="webworker" />
import { precacheAndRoute, matchPrecache } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { setCacheNameDetails } from 'workbox-core'
declare const __APP_VERSION__: string
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}
setCacheNameDetails({ prefix: 'parallel-shell', suffix: __APP_VERSION__ })
precacheAndRoute(self.__WB_MANIFEST)
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting()
  if (event.data?.type === 'VERSION') event.ports[0]?.postMessage({ appVersion: __APP_VERSION__ })
})
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/data/v-'),
  async ({ request }) => {
    // Repair must bypass even a corrupt complete cache. Newest committed generation wins.
    if (request.cache === 'reload' || request.cache === 'no-store') return fetch(request)
    for (const name of (await caches.keys())
      .filter((n) => n.startsWith('parallel-pack-'))
      .reverse()) {
      const cache = await caches.open(name)
      if (!(await cache.match('/__complete__'))) continue
      const hit = await cache.match(request)
      if (hit) return hit
    }
    try {
      return await fetch(request)
    } catch {
      return new Response(JSON.stringify({ error: 'Text not downloaded' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
)
// A newly activated worker can still serve chunks requested by an older open tab.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/assets/'),
  async ({ request }) => {
    const cached = await caches.match(request)
    if (cached) return cached
    try {
      return await fetch(request)
    } catch {
      return new Response('Asset unavailable', { status: 503 })
    }
  },
)
registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' &&
    (/^\/(?:timeline|search|bookmarks|downloads|about)?\/?$/.test(url.pathname) ||
      /^\/(?:events\/evt_\d{6}|entities\/ent_\d{6}|journeys\/jrn_\d{6}|sources\/src_\d{6})\/?$/.test(
        url.pathname,
      )),
  async ({ request }) => {
    try {
      return await fetch(request)
    } catch {
      return (
        (await matchPrecache('/_shell.html')) ||
        new Response('Open the atlas online to prepare offline reading.', { status: 503 })
      )
    }
  },
)
