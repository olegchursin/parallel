import { test as base, expect, type Page } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
const endpoints = new Map<string, { blocked: boolean; server: Server }>()
// Playwright 1.63 WebKit rejects SW navigations under setOffline, even for a literal
// response: microsoft/playwright#42775. A dead origin exercises the actual worker.
const test = base.extend<{ offlineNetwork: () => Promise<void> }>({
  baseURL: async ({ browserName }, use) => {
    const control = { blocked: false, server: null as unknown as Server }
    const server = createServer(async (req, res) => {
      if (control.blocked) {
        req.socket.destroy()
        return
      }
      const url = new URL(req.url!, 'http://localhost'),
        path = decodeURIComponent(url.pathname)
      let file = resolve('dist/client', '.' + path)
      if (!extname(file)) file += '/index.html'
      try {
        const body = await readFile(file)
        const mime: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.json': 'application/json',
          '.webmanifest': 'application/manifest+json',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
        }
        res.writeHead(200, {
          'Content-Type': mime[extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        })
        res.end(body)
      } catch {
        res.writeHead(404)
        res.end('Not found')
      }
    })
    control.server = server
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const addr = server.address() as { port: number },
      url = 'http://127.0.0.1:' + addr.port
    endpoints.set(url, control)
    await use(url)
    server.closeAllConnections()
    await new Promise<void>((r) => server.close(() => r()))
    endpoints.delete(url)
  },
  offlineNetwork: async ({ context, baseURL, browserName }, use) => {
    await use(async () => {
      endpoints.get(baseURL!)!.blocked = true
      if (browserName !== 'webkit') await context.setOffline(true)
    })
  },
})
async function readyWorker(page: Page) {
  await page.goto('/downloads')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
}
const card = (page: Page, title: string) =>
  page.locator('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
test('complete text pack, offline deep links, search, sources and shell reopen', async ({
  page,
  context,
  offlineNetwork,
}) => {
  await readyWorker(page)
  const all = card(page, 'The complete text atlas')
  await all.getByRole('button', { name: 'Download collection' }).click()
  await expect(all).toContainText('Ready offline')
  await offlineNetwork()
  await page.goto('/events/evt_000004')
  await expect(page.locator('h1')).toContainText('Angkor')
  await page.reload()
  await expect(page.locator('h1')).toContainText('Angkor')
  await page.goto('/search?q=Gutenberg')
  await expect(
    page.getByRole('link', { name: 'The Gutenberg Bible is completed at Mainz' }),
  ).toBeVisible()
  await page.goto('/sources/src_000001')
  await expect(page.locator('h1')).toContainText('Caral')
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('History didn’t happen')
  await page.goto('/downloads')
  await expect(card(page, 'The complete text atlas')).toContainText('Ready offline')
})
test('interrupted replacement retains a complete generation and supports removal', async ({
  page,
}) => {
  await readyWorker(page)
  const starter = card(page, 'Starter atlas')
  await starter.getByRole('button', { name: 'Download collection' }).click()
  await expect(starter).toContainText('Ready offline')
  await page.route('**/data/v-*/details-*.json', async (route) => {
    await new Promise((r) => setTimeout(r, 1200))
    await route.continue().catch(() => {})
  })
  await starter.getByRole('button', { name: 'Repair / redownload' }).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('cancelled')
  await expect(starter).toContainText('Ready offline')
  const names = await page.evaluate(() => caches.keys())
  expect(names.filter((n) => n.startsWith('parallel-stage-'))).toHaveLength(0)
  await starter.getByRole('button', { name: 'Remove Starter atlas' }).click()
  await expect(starter.getByRole('button', { name: 'Download collection' })).toBeVisible()
})
test('corrupt file is detected, repaired, and replaced atomically', async ({ page }) => {
  await readyWorker(page)
  const starter = card(page, 'Starter atlas')
  await starter.getByRole('button', { name: 'Download collection' }).click()
  await expect(starter).toContainText('Ready offline')
  await page.evaluate(async () => {
    const name = (await caches.keys()).find((n) => n.startsWith('parallel-pack-'))!
    const c = await caches.open(name)
    const key = (await c.keys()).find((r) => r.url.includes('details-'))!
    await c.put(
      key,
      new Response('{"corrupt":true}', { headers: { 'Content-Type': 'application/json' } }),
    )
  })
  await starter.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Missing or corrupt')
  await starter.getByRole('button', { name: 'Repair / redownload' }).click()
  await expect(page.getByRole('status')).toContainText('ready offline')
  await starter.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('every file passed')
})
test('quota failure and failed replacement leave prior content intact', async ({ page }) => {
  await readyWorker(page)
  const starter = card(page, 'Starter atlas')
  await starter.getByRole('button', { name: 'Download collection' }).click()
  await expect(starter).toContainText('Ready offline')
  await page.evaluate(() => {
    Object.defineProperty(Object.getPrototypeOf(navigator.storage), 'estimate', {
      configurable: true,
      value: async () => ({ usage: 100, quota: 101 }),
    })
  })
  await starter.getByRole('button', { name: 'Repair / redownload' }).click()
  await expect(page.getByRole('status')).toContainText('Not enough storage')
  await expect(starter).toContainText('Ready offline')
  await page.evaluate(() => {
    Object.defineProperty(Object.getPrototypeOf(navigator.storage), 'estimate', {
      configurable: true,
      value: async () => ({ usage: 0, quota: 1000000000 }),
    })
    const original = Cache.prototype.put
    Cache.prototype.put = async function (request, response) {
      if (typeof request === 'string' && request.includes('details-'))
        throw new DOMException('Simulated quota exhaustion', 'QuotaExceededError')
      return original.call(this, request, response)
    }
  })
  await starter.getByRole('button', { name: 'Repair / redownload' }).click()
  await expect(page.getByRole('status')).toContainText('quota')
  await expect(starter).toContainText('Ready offline')
})
test('two open tabs pin a release, retained caches survive replacement', async ({
  page,
  context,
  offlineNetwork,
}) => {
  await readyWorker(page)
  const starter = card(page, 'Starter atlas')
  await starter.getByRole('button', { name: 'Download collection' }).click()
  await expect(starter).toContainText('Ready offline')
  const second = await context.newPage()
  await second.goto('/events/evt_000001')
  await starter.getByRole('button', { name: 'Repair / redownload' }).click()
  await expect(starter).toContainText('2 complete generations retained')
  await offlineNetwork()
  await second.reload()
  await expect(second.locator('h1')).toContainText('Caral')
  expect(
    (await page.evaluate(() => caches.keys())).filter((n) => n.startsWith('parallel-pack-')),
  ).toHaveLength(2)
})
test('a corrupt replacement never becomes ready', async ({ page }) => {
  await readyWorker(page)
  const starter = card(page, 'Starter atlas')
  await starter.getByRole('button', { name: 'Download collection' }).click()
  await expect(starter).toContainText('Ready offline')
  await page.evaluate(() => {
    const original = window.fetch
    Object.defineProperty(window, 'fetch', {
      value: async (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).includes('details-')
          ? new Response('{"wrong":true}', { headers: { 'Content-Type': 'application/json' } })
          : original(input, init),
    })
  })
  await starter.getByRole('button', { name: 'Repair / redownload' }).click()
  await expect(page.getByRole('status')).toContainText('Integrity check failed')
  expect(
    (await page.evaluate(() => caches.keys())).filter((n) => n.startsWith('parallel-pack-')),
  ).toHaveLength(1)
  expect(
    (await page.evaluate(() => caches.keys())).filter((n) => n.startsWith('parallel-stage-')),
  ).toHaveLength(0)
})
test('a missing offline shard produces a recoverable error', async ({ page, offlineNetwork }) => {
  await readyWorker(page)
  const all = card(page, 'The complete text atlas')
  await all.getByRole('button', { name: 'Download collection' }).click()
  await expect(all).toContainText('Ready offline')
  await page.evaluate(async () => {
    const name = (await caches.keys()).find((n) => n.startsWith('parallel-pack-'))!
    const c = await caches.open(name)
    for (const request of await c.keys())
      if (request.url.includes('details-000')) await c.delete(request)
  })
  await offlineNetwork()
  await page.goto('/timeline?view=read&selected=evt_000004')
  await expect(page.getByRole('dialog')).toContainText('Text unavailable')
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'Manage downloads' }),
  ).toBeVisible()
})
