import { createIsomorphicFn } from '@tanstack/react-start'
import release from '../generated/release.json'
import type {
  Catalog,
  Manifest,
  EventRecord,
  EntityRecord,
  JourneyRecord,
  SourceRecord,
  RelationRecord,
} from './schema'

const transport = createIsomorphicFn()
  .server(async (url: string) => {
    const { readFile } = await import('node:fs/promises')
    if (!/^\/data\/(?:v-[a-f0-9]{16}\/)?[a-zA-Z0-9_.-]+\.json$/.test(url))
      throw new Error('Invalid content path')
    return new Uint8Array(await readFile(process.cwd() + '/public' + url))
  })
  .client(async (url: string) => {
    const response = await fetch(url)
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
      throw new Error(
        'This text is unavailable. Connect to the internet or repair its download in Downloads.',
      )
    return new Uint8Array(await response.arrayBuffer())
  })
export async function digest(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
}
async function decode<T>(url: string, expected: string): Promise<T> {
  const bytes = await transport(url)
  if ((await digest(bytes)) !== expected)
    throw new Error('Integrity check failed. Please repair this download before using it.')
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as T
}
let manifestPromise: Promise<Manifest> | undefined
export function getManifest() {
  return (manifestPromise ||= decode<Manifest>(release.manifestUrl, release.manifestSha256)
    .then((m) => {
      if (
        m.schemaVersion !== 1 ||
        m.minimumAppSchema > 1 ||
        m.contentVersion !== release.contentVersion
      )
        throw new Error('Content update requires a compatible app version.')
      return m
    })
    .catch((e) => {
      manifestPromise = undefined
      throw e
    }))
}
// One adapter contract for server prerendering and browser fetches. No authoring imports.
export const content = {
  manifest: getManifest,
  async artifact<T>(name: string): Promise<T> {
    const m = await getManifest(),
      a = m.artifacts[name]
    if (!a) throw new Error('This content file is not in the current release.')
    return decode<T>(a.url, a.sha256)
  },
  async record<T extends EventRecord | EntityRecord | JourneyRecord | SourceRecord>(
    id: string,
  ): Promise<T> {
    const m = await getManifest()
    if (m.withdrawals[id]) throw new Error('Withdrawn: ' + m.withdrawals[id])
    const resolved = m.redirects[id] || id,
      name = m.recordToShard[resolved]
    if (!name) throw new Error('Record not found in this release.')
    const data = await this.artifact<T | Record<string, T>>(name)
    return (resolved.startsWith('evt_') ? (data as Record<string, T>)[resolved] : data) as T
  },
  catalog: () => content.artifact<Catalog>('catalog.json'),
  relations: () => content.artifact<RelationRecord[]>('relations.json'),
}
export { release }
