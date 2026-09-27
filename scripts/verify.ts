import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import type { Manifest } from '../src/lib/schema'
const root = 'dist/client',
  sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')
const release = JSON.parse(await readFile(root + '/data/release.json', 'utf8')),
  manifestBytes = await readFile(root + release.manifestUrl)
if (sha(manifestBytes) !== release.manifestSha256) throw new Error('Manifest hash mismatch')
const manifest = JSON.parse(manifestBytes.toString()) as Manifest
for (const [key, a] of Object.entries(manifest.artifacts)) {
  const bytes = await readFile(root + a.url)
  if (bytes.length !== a.bytes || sha(bytes) !== a.sha256) throw new Error('Bad artifact ' + key)
  JSON.parse(bytes.toString())
}
const versions = (await readdir(root + '/data')).filter((n) => n.startsWith('v-'))
if (versions.length !== 1 || versions[0] !== manifest.contentVersion)
  throw new Error(
    'Build must contain only the selected release; deploy previous versions separately',
  )
const routes = JSON.parse(await readFile('src/generated/routes.json', 'utf8')) as string[]
for (const path of routes) {
  const html = await readFile(root + (path === '/' ? '' : path) + '/index.html', 'utf8')
  if (!html.includes('<h1') || html.includes('An unexpected error occurred'))
    throw new Error('Invalid prerender ' + path)
}
for (const file of [
  '_shell.html',
  'sw.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'favicon.svg',
])
  if (!(await stat(root + '/' + file)).size) throw new Error('Missing shell asset ' + file)
const files = await readdir(root + '/assets'),
  scripts = files.filter((n) => n.endsWith('.js')),
  styles = files.filter((n) => n.endsWith('.css'))
const gzip = async (path: string) => gzipSync(await readFile(path)).length
const js = await Promise.all(
    scripts.map(async (name) => ({ name, gzipBytes: await gzip(root + '/assets/' + name) })),
  ),
  css = await Promise.all(
    styles.map(async (name) => ({ name, gzipBytes: await gzip(root + '/assets/' + name) })),
  )
// Conservative: sum every route chunk, stronger than initial-route budget.
const allJs = js.reduce((n, a) => n + a.gzipBytes, 0),
  allCss = css.reduce((n, a) => n + a.gzipBytes, 0),
  overview = await gzip(root + manifest.artifacts['catalog.json'].url),
  search = await gzip(root + manifest.artifacts['search.json'].url),
  allText = (
    await Promise.all(Object.values(manifest.artifacts).map((a) => gzip(root + a.url)))
  ).reduce((a, b) => a + b, 0),
  home = await gzip(root + '/index.html')
const budgets = {
  allRouteJavaScriptGzipBytes: allJs,
  initialCssGzipBytes: allCss,
  overviewGzipBytes: overview,
  searchGzipBytes: search,
  allTextGzipBytes: allText,
  landingHtmlGzipBytes: home,
  conservativeLandingGzipBytes: allJs + allCss + home,
  limits: {
    initialJs: 250000,
    css: 40000,
    overview: 250000,
    search: 500000,
    allText: 15000000,
    landing: 1000000,
  },
}
if (
  allJs > 250000 ||
  allCss > 40000 ||
  overview > 250000 ||
  search > 500000 ||
  allText > 15000000 ||
  allJs + allCss + home > 1000000
)
  throw new Error('Transfer budget exceeded: ' + JSON.stringify(budgets))
if (
  manifest.mode === 'production' &&
  manifest.recordCounts.published !== manifest.recordCounts.events
)
  throw new Error('Preview data in production')
const result = {
  verifiedAt: new Date().toISOString(),
  contentVersion: manifest.contentVersion,
  mode: manifest.mode,
  prerenderedPages: routes.length,
  verifiedArtifacts: Object.keys(manifest.artifacts).length,
  budgets,
  scripts: js,
  styles: css,
  limitsOfVerification: [
    'Gzip sizes measured from built bytes; the local server is uncompressed. Configure gzip/Brotli on a deployment host.',
    'Real-device p75 Web Vitals and installed-PWA performance are not measured by this check.',
  ],
}
await mkdir('docs/reports', { recursive: true })
await writeFile('docs/reports/release.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
