import { resolve, extname } from 'node:path'
import { existsSync } from 'node:fs'

const root = resolve('dist/client')
const port = Number(process.env.PORT || 4173)
const interactive = new Set(['/timeline', '/search', '/bookmarks', '/downloads'])
const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  async fetch(req) {
    let pathname: string
    try {
      pathname = decodeURIComponent(new URL(req.url).pathname)
    } catch {
      return new Response('Bad URL', { status: 400 })
    }
    const relative = pathname.replace(/^\/+/, '')
    const filePath = resolve(root, relative)
    if (!filePath.startsWith(root + '/') && filePath !== root)
      return new Response('Forbidden', { status: 403 })
    let file = extname(filePath) ? filePath : resolve(filePath, 'index.html')
    if (!existsSync(file) && interactive.has(pathname.replace(/\/$/, '')))
      file = resolve(root, '_shell.html')
    if (!existsSync(file))
      return new Response('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' },
      })
    const body = Bun.file(file)
    const immutable =
      /\/(assets|data\/v-)[^]*\//.test(pathname) ||
      pathname.startsWith('/assets/') ||
      /^\/data\/v-/.test(pathname)
    return new Response(req.method === 'HEAD' ? null : body, {
      headers: {
        'Content-Type': body.type,
        'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      },
    })
  },
})
console.log(`Parallel production preview: ${server.url}`)
