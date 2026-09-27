import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Link, useNavigate, useSearch, useRouterState } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Compass,
  Download,
  Menu,
  Search,
  X,
  WifiOff,
  RefreshCw,
} from 'lucide-react'
import type { Catalog, Manifest } from '../lib/schema'
import { DEFAULTS, type SearchState } from '../lib/state'
import { readBookmarks, readPreference, toggleBookmark, writePreference } from '../lib/persistence'
import s from '../styles/App.module.css'
export const AppContext = createContext<{ catalog: Catalog; manifest: Manifest } | null>(null)
export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('Atlas text unavailable. Download the Starter pack while online.')
  return value
}
const subscribeHydration = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false
export function useAtlasState() {
  const routeState = useSearch({ from: '__root__' }),
    hydrated = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot),
    navigate = useNavigate()
  // One prerendered document serves every query variant. Hydrate that document
  // with its canonical state before applying the actual shared-link filters.
  const state = hydrated ? routeState : DEFAULTS
  const set = (patch: Partial<SearchState>, replace = false) =>
    navigate({ to: '/timeline', search: { ...routeState, ...patch, notice: undefined }, replace })
  return [state, set] as const
}
export function BookmarkButton({
  id,
  title,
  view,
  compact = false,
}: {
  id: string
  title: string
  view?: SearchState
  compact?: boolean
}) {
  const [saved, setSaved] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    const sync = () => setSaved(readBookmarks().some((b) => b.id === id))
    sync()
    window.addEventListener('parallel-bookmarks', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('parallel-bookmarks', sync)
      window.removeEventListener('storage', sync)
    }
  }, [id])
  return (
    <>
      <button
        className={s.iconText}
        aria-label={(saved ? 'Remove bookmark for ' : 'Bookmark ') + title}
        aria-pressed={saved}
        onClick={() => {
          try {
            toggleBookmark(id, title, view)
            setError('')
          } catch (e) {
            setError(String(e))
          }
        }}
      >
        {saved ? <Check size={17} /> : <Bookmark size={17} />}{' '}
        {!compact && (saved ? 'Saved' : 'Save')}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  )
}
export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (x) => x.location.pathname }),
    [menu, setMenu] = useState(false),
    [offline, setOffline] = useState(false),
    [theme, setTheme] = useState('system'),
    [update, setUpdate] = useState<ServiceWorkerRegistration>(),
    [contentUpdate, setContentUpdate] = useState(false)
  useEffect(() => {
    setMenu(false)
  }, [path])
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    const t = readPreference('theme', 'system')
    setTheme(t)
    document.documentElement.dataset.theme = t
    if (import.meta.env.PROD && 'serviceWorker' in navigator)
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          if (reg.waiting) setUpdate(reg)
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) setUpdate(reg)
            })
          })
        })
        .catch(() => {})
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])
  const nav = [
    ['/timeline', 'Explore'],
    ['/#journeys', 'Journeys'],
    ['/bookmarks', 'Saved'],
    ['/downloads', 'Downloads'],
    ['/about', 'About'],
  ] as const
  return (
    <div className={s.app}>
      <a className={s.skip} href="#main">
        Skip to content
      </a>
      <header className={s.header}>
        <Link to="/" className={s.brand} aria-label="Parallel home">
          <Compass size={31} strokeWidth={1.35} />
          <span>
            parallel<span className={s.brandSub}>A WORLD HISTORY ATLAS</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className={`${s.nav} ${menu ? s.navOpen : ''}`}>
          {nav.map(([url, label]) =>
            url === '/#journeys' ? (
              <a key={url} href={url}>
                {label}
              </a>
            ) : (
              <Link key={url} to={url} aria-current={path === url ? 'page' : undefined}>
                {label}
              </Link>
            ),
          )}
        </nav>
        <div className={s.headerRight}>
          <span className={s.preview}>
            <i /> Research preview
          </span>
          <Link to="/search" className={s.iconButton} aria-label="Search the atlas">
            <Search size={20} />
          </Link>
          <button
            className={`${s.iconButton} ${s.menuButton}`}
            aria-expanded={menu}
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {offline && (
        <div className={s.status}>
          <WifiOff size={15} /> Offline · downloaded text remains available. External source sites
          require a connection.
        </div>
      )}
      {(update || contentUpdate) && (
        <div className={s.status}>
          <RefreshCw size={16} /> An update is available. Your current content version stays pinned
          until you reload.
          <button
            onClick={async () => {
              const registration = await navigator.serviceWorker?.getRegistration()
              const installing = registration?.installing
              if (
                !registration?.waiting &&
                installing &&
                installing.state !== 'installed' &&
                installing.state !== 'redundant'
              ) {
                await new Promise<void>((resolve) => {
                  installing.addEventListener('statechange', () => {
                    if (installing.state === 'installed' || installing.state === 'redundant')
                      resolve()
                  })
                })
              }
              const waiting =
                registration?.waiting || (installing?.state === 'installed' ? installing : null)
              if (waiting) {
                navigator.serviceWorker.addEventListener(
                  'controllerchange',
                  () => location.reload(),
                  { once: true },
                )
                waiting.postMessage({ type: 'ACTIVATE_UPDATE' })
              } else location.reload()
            }}
          >
            Apply update & reload
          </button>
        </div>
      )}
      {children}
      <footer className={s.footer}>
        <div>
          <Link to="/" className={s.footerBrand}>
            parallel
          </Link>
          <p>One world. Many histories.</p>
          <small>A sourced research preview · Historical coverage through 31 December 2025.</small>
        </div>
        <div className={s.footerLinks}>
          <Link to="/about">
            Evidence & coverage <ArrowUpRight size={14} />
          </Link>
          <Link to="/downloads">
            <Download size={14} /> Read offline
          </Link>
          <label>
            Appearance{' '}
            <select
              aria-label="Appearance"
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value)
                document.documentElement.dataset.theme = e.target.value
                writePreference('theme', e.target.value)
              }}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="contrast">High contrast</option>
            </select>
          </label>
          <button
            className={s.textButton}
            onClick={async () => {
              try {
                const { release } = await import('../lib/content')
                const r = await fetch('/data/release.json', { cache: 'no-store' })
                if (!r.ok) throw new Error()
                const next = await r.json()
                setContentUpdate(next.contentVersion !== release.contentVersion)
                const reg = await navigator.serviceWorker?.getRegistration()
                await reg?.update()
                if (next.contentVersion === release.contentVersion && !reg?.waiting)
                  alert('You have the current app and content version.')
              } catch {
                alert('Update check unavailable. Try again when connected.')
              }
            }}
          >
            Check for updates
          </button>
        </div>
      </footer>
    </div>
  )
}
export function Unavailable({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <main id="main" className={s.page}>
      <div className={s.empty}>
        <WifiOff size={32} />
        <h1>This text isn’t available yet</h1>
        <p>{message}</p>
        <p>Connect once to open the atlas or download a text pack for offline reading.</p>
        {retry && (
          <button className={s.primary} onClick={retry}>
            Try again
          </button>
        )}
        <Link to="/downloads" className={s.secondary}>
          Manage downloads
        </Link>
      </div>
    </main>
  )
}
