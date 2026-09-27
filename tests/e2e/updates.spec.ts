import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
test('explicit worker activation retains old shell caches and the other tab’s pinned content', async ({
  browser,
}) => {
  let next = false
  const release = JSON.parse(await readFile('dist/client/data/release.json', 'utf8'))
  const app = JSON.parse(await readFile('dist/client/app-version.json', 'utf8'))
  const server = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://local').pathname
    let file = resolve('dist/client', '.' + path)
    if (!extname(file)) file += '/index.html'
    try {
      let body = await readFile(file)
      if (next && path === '/sw.js')
        body = Buffer.from(body.toString().replaceAll(app.appVersion, 'updatefixture1'))
      if (next && path === '/data/release.json')
        body = Buffer.from(JSON.stringify({ ...release, contentVersion: 'v-ffffffffffffffff' }))
      res.writeHead(200, {
        'Content-Type':
          (
            {
              '.html': 'text/html',
              '.js': 'application/javascript',
              '.json': 'application/json',
              '.css': 'text/css',
              '.webmanifest': 'application/manifest+json',
              '.png': 'image/png',
              '.svg': 'image/svg+xml',
            } as Record<string, string>
          )[extname(file)] || 'text/plain',
        'Cache-Control': 'no-store',
      })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port,
    context = await browser.newContext({ baseURL: origin }),
    page = await context.newPage()
  try {
    await page.goto('/downloads')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    const second = await context.newPage()
    await second.goto('/downloads')
    await expect(second.locator('main')).toContainText(release.contentVersion)
    next = true
    await page.getByRole('button', { name: 'Check for updates' }).click()
    await expect(page.getByRole('button', { name: 'Apply update & reload' })).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting),
      )
      .toBe(true)
    // The release pointer has changed, but this open tab continues to display the old pin.
    await expect(second.locator('main')).toContainText(release.contentVersion)
    await expect(second.locator('main')).not.toContainText('v-ffffffffffffffff')
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Apply update & reload' }).click(),
    ])
    await expect(
      page.getByRole('heading', { name: 'History, without a connection.' }),
    ).toBeVisible()
    const version = await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      return await new Promise<string>((resolve) => {
        const ch = new MessageChannel()
        ch.port1.onmessage = (e) => resolve(e.data.appVersion)
        navigator.serviceWorker.controller!.postMessage({ type: 'VERSION' }, [ch.port2])
      })
    })
    expect(version).toBe('updatefixture1')
    const names = await page.evaluate(() => caches.keys())
    expect(names.some((n) => n.includes(app.appVersion))).toBe(true)
    expect(names.some((n) => n.includes('updatefixture1'))).toBe(true)
    await expect(second.locator('main')).toContainText(release.contentVersion)
  } finally {
    await context.close()
    server.closeAllConnections()
    await new Promise<void>((r) => server.close(() => r()))
  }
})
