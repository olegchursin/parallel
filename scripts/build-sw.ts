import { injectManifest } from 'workbox-build'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const assets = readdirSync('dist/client/assets').sort()
const buildId = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12)
await Bun.build({
  entrypoints: ['src/sw.ts'],
  outdir: 'dist',
  target: 'browser',
  format: 'iife',
  define: { __APP_VERSION__: JSON.stringify(buildId) },
  minify: true,
})
const result = await injectManifest({
  swSrc: 'dist/sw.js',
  swDest: 'dist/client/sw.js',
  globDirectory: 'dist/client',
  globPatterns: [
    'assets/*.{js,css}',
    'icons/*.png',
    'favicon.svg',
    'manifest.webmanifest',
    '_shell.html',
    'index.html',
    'about/index.html',
  ],
  maximumFileSizeToCacheInBytes: 3_000_000,
})
writeFileSync('dist/client/app-version.json', JSON.stringify({ appVersion: buildId }))
console.log(`Service worker ${buildId}: ${result.count} shell assets, ${result.size} bytes`)
if (!readFileSync('dist/client/sw.js', 'utf8').includes(buildId))
  throw new Error('Worker version missing')
