import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'

const pages: string[] = existsSync('src/generated/routes.json')
  ? JSON.parse(readFileSync('src/generated/routes.json', 'utf8'))
  : ['/', '/events/evt_000001']
export default defineConfig({
  server: { host: '127.0.0.1', port: 3000 },
  plugins: [
    tanstackStart({
      spa: { enabled: true, maskPath: '/offline', prerender: { outputPath: '/_shell.html' } },
      prerender: {
        enabled: true,
        crawlLinks: false,
        autoStaticPathsDiscovery: false,
        concurrency: 4,
        failOnError: true,
      },
      pages: pages.map((path) => ({ path, prerender: { enabled: true } })),
    }),
    react(),
  ],
})
