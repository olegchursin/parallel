import { chromium } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
const release = JSON.parse(await readFile('public/data/release.json', 'utf8')),
  catalog = JSON.parse(
    await readFile('public/data/' + release.contentVersion + '/catalog.json', 'utf8'),
  )
await Bun.build({
  entrypoints: ['tests/stress-entry.ts'],
  outdir: 'tmp',
  target: 'browser',
  format: 'iife',
})
let ownedServer: ReturnType<typeof Bun.spawn> | undefined
try {
  await fetch('http://127.0.0.1:4173/')
} catch {
  ownedServer = Bun.spawn([process.execPath, 'scripts/serve.ts'], {
    stdout: 'ignore',
    stderr: 'inherit',
  })
  let ready = false
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100))
    try {
      if ((await fetch('http://127.0.0.1:4173/')).ok) {
        ready = true
        break
      }
    } catch {}
  }
  if (!ready) {
    ownedServer.kill()
    throw new Error('Preview server did not start')
  }
}
process.on('exit', () => ownedServer?.kill())
const browser = await chromium.launch(),
  context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
  page = await context.newPage()
await page.addInitScript(() => {
  ;(window as unknown as { measurements: unknown }).measurements = { lcp: 0, cls: 0 }
  new PerformanceObserver((list) => {
    for (const e of list.getEntries())
      (window as unknown as { measurements: { lcp: number } }).measurements.lcp = e.startTime
  }).observe({ type: 'largest-contentful-paint', buffered: true })
  new PerformanceObserver((list) => {
    for (const e of list.getEntries())
      if (!(e as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput)
        (window as unknown as { measurements: { cls: number } }).measurements.cls += (
          e as PerformanceEntry & { value: number }
        ).value
  }).observe({ type: 'layout-shift', buffered: true })
})
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
const lab = await page.evaluate(() => ({
  ...(window as unknown as { measurements: object }).measurements,
  navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
  resources: performance
    .getEntriesByType('resource')
    .map((e) => ({ name: e.name, transferSize: (e as PerformanceResourceTiming).transferSize })),
}))
await page.addScriptTag({ path: 'tmp/stress-entry.js' })
const stress = await page.evaluate(
  (seed) =>
    (
      window as unknown as {
        parallelBenchmark: (data: unknown) => { searchMedianMs: number; accessibleRecords: number }
      }
    ).parallelBenchmark(seed),
  catalog.events,
)
if (stress.accessibleRecords !== 5000 || stress.searchMedianMs > 100)
  throw new Error('Stress budget failed: ' + JSON.stringify(stress))
await mkdir('docs/reports', { recursive: true })
await writeFile(
  'docs/reports/performance.json',
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      environment:
        'Chromium desktop engine, 390×844 viewport, local loopback; no CPU/network throttling. Not a real phone or field p75.',
      stress,
      lab,
      unverified: [
        'Real midrange-phone 60fps pan/zoom',
        'Installed-PWA reopening under 2 seconds',
        'Field p75 LCP, INP, CLS',
      ],
    },
    null,
    2,
  ) + '\n',
)
console.log(stress)
await browser.close()

ownedServer?.kill()
