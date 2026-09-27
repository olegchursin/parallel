import { z } from 'zod'
import { validateSearch, type SearchState } from './state'
const KEY = 'parallel.bookmarks.v1'
const bookmarkSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^evt_\d{6}$/),
  label: z.string().max(200),
  savedAt: z.string().datetime(),
  view: z.record(z.string(), z.unknown()).optional(),
})
const exportSchema = z.object({
  schemaVersion: z.literal(1),
  bookmarks: z.array(bookmarkSchema).max(1000),
})
export type Bookmark = {
  schemaVersion: 1
  id: string
  label: string
  savedAt: string
  view?: SearchState
}
export function parseBookmarks(text: string, validIds: Set<string>): Bookmark[] {
  if (new TextEncoder().encode(text).length > 500_000)
    throw new Error('Bookmark file exceeds 500 KB.')
  const result = exportSchema.safeParse(JSON.parse(text))
  if (!result.success)
    throw new Error(
      'Invalid bookmark file. Use a Parallel schema 1 export with valid event IDs, labels and dates.',
    )
  const v = result.data
  return v.bookmarks.map((b) => {
    if (!validIds.has(b.id)) throw new Error('Unknown or withdrawn record: ' + b.id)
    return { ...b, view: b.view ? validateSearch(b.view) : undefined }
  })
}
export function readBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = exportSchema.parse(JSON.parse(raw))
    return parsed.bookmarks.map((b) => ({
      ...b,
      view: b.view ? validateSearch(b.view) : undefined,
    }))
  } catch {
    return []
  }
}
export function writeBookmarks(values: Bookmark[]) {
  if (values.length > 1000) throw new Error('The limit is 1,000 bookmarks.')
  const text = JSON.stringify({ schemaVersion: 1, bookmarks: values })
  if (new TextEncoder().encode(text).length > 500_000)
    throw new Error('Bookmarks exceed the storage budget.')
  localStorage.setItem(KEY, text)
  window.dispatchEvent(new Event('parallel-bookmarks'))
}
export function toggleBookmark(id: string, title: string, view?: SearchState) {
  const all = readBookmarks()
  writeBookmarks(
    all.some((b) => b.id === id)
      ? all.filter((b) => b.id !== id)
      : [...all, { schemaVersion: 1, id, label: title, savedAt: new Date().toISOString(), view }],
  )
}
export function readPreference<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem('parallel.preferences.v1.' + key) || 'null') ?? fallback
  } catch {
    return fallback
  }
}
export function writePreference(key: string, value: unknown) {
  try {
    localStorage.setItem('parallel.preferences.v1.' + key, JSON.stringify(value))
  } catch {
    /* Private storage can be unavailable; preference remains for this visit. */
  }
}
