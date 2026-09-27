import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  stripSearchParams,
  type SearchSchemaInput,
} from '@tanstack/react-router'
import { content } from '../lib/content'
import { validateSearch } from '../lib/state'
import { AppContext, Shell, Unavailable } from '../components/App'
import '../styles/global.css'
export const Route = createRootRoute({
  validateSearch: (raw: Record<string, unknown> & SearchSchemaInput) => validateSearch(raw),
  search: {
    middlewares: [
      stripSearchParams({
        v: 1,
        regions: [],
        themes: [],
        q: '',
        density: 'balanced',
        view: 'atlas',
      }),
    ],
  },
  loader: async () => {
    try {
      const [catalog, manifest] = await Promise.all([content.catalog(), content.manifest()])
      return { catalog, manifest, error: null }
    } catch (e) {
      return { catalog: null, manifest: null, error: e instanceof Error ? e.message : String(e) }
    }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Parallel — A World History Atlas' },
      {
        name: 'description',
        content:
          'Explore world history side by side. A sourced research preview across ten regions, with timelines, reading journeys and offline text.',
      },
      { name: 'theme-color', content: '#234c40' },
    ],
    links: [
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/favicon.svg' },
      { rel: 'apple-touch-icon', href: '/icons/icon-192.png' },
    ],
  }),
  component: Root,
  notFoundComponent: () => (
    <main id="main" style={{ padding: '5rem' }}>
      <h1>We couldn’t find that page</h1>
      <p>The address may be incomplete or the record unavailable in this release.</p>
      <a href="/">Return to the atlas</a>
    </main>
  ),
  errorComponent: ({ error, reset }) => (
    <Unavailable message={error instanceof Error ? error.message : String(error)} retry={reset} />
  ),
})
function Root() {
  const data = Route.useLoaderData()
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Shell>
          {data.catalog && data.manifest ? (
            <AppContext value={{ catalog: data.catalog, manifest: data.manifest }}>
              <Outlet />
            </AppContext>
          ) : (
            <Unavailable
              message={data.error || 'Content could not be loaded.'}
              retry={() => location.reload()}
            />
          )}
        </Shell>
        <Scripts />
      </body>
    </html>
  )
}
