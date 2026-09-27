import { digest, release } from './content'
import type { Manifest, Pack } from './schema'
export const READY = '/__complete__'
export type DownloadStatus = {
  name: string
  packId: string
  version: string
  bytes: number
  savedAt: string
}
export async function downloaded(): Promise<DownloadStatus[]> {
  if (!('caches' in globalThis)) return []
  const result: DownloadStatus[] = []
  for (const name of await caches.keys()) {
    if (!name.startsWith('parallel-pack-')) continue
    const marker = await (await caches.open(name)).match(READY)
    if (marker)
      try {
        result.push({ ...(await marker.json()), name })
      } catch {
        /* Incomplete cache is not published. */
      }
  }
  return result
}
export async function downloadPack(
  m: Manifest,
  p: Pack,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
) {
  if (!('caches' in globalThis))
    throw new Error('Offline storage requires HTTPS or localhost and browser Cache Storage.')
  const estimate = await navigator.storage?.estimate()
  if (
    estimate?.quota &&
    estimate.usage !== undefined &&
    estimate.quota - estimate.usage < p.bytes * 1.2
  )
    throw new Error(
      'Not enough storage. Remove a download and retry; your previous download is intact.',
    )
  const nonce = crypto.randomUUID(),
    staging = 'parallel-stage-' + nonce,
    final = `parallel-pack-${m.contentVersion}-${p.id}-${nonce}`
  let promoted = false
  try {
    const cache = await caches.open(staging)
    let done = 0
    for (const key of p.artifacts) {
      signal.throwIfAborted()
      const a = m.artifacts[key]
      const response = await fetch(a.url, { signal, cache: 'reload' })
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
        throw new Error('Missing content file: ' + key)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length !== a.bytes || (await digest(bytes)) !== a.sha256)
        throw new Error('Integrity check failed for ' + key + '. Previous downloads remain intact.')
      await cache.put(
        a.url,
        new Response(bytes, { headers: { 'Content-Type': 'application/json' } }),
      )
      done += a.bytes
      onProgress(done, p.bytes)
    }
    const response = await fetch(release.manifestUrl, { signal, cache: 'reload' })
    if (!response.ok) throw new Error('Manifest unavailable')
    const bytes = new Uint8Array(await response.arrayBuffer())
    if ((await digest(bytes)) !== release.manifestSha256)
      throw new Error('Manifest integrity check failed')
    await cache.put(
      release.manifestUrl,
      new Response(bytes, { headers: { 'Content-Type': 'application/json' } }),
    )
    signal.throwIfAborted()
    const complete = await caches.open(final)
    for (const request of await cache.keys()) {
      signal.throwIfAborted()
      await complete.put(request, (await cache.match(request))!)
    }
    // The marker is the commit point. Readers never inspect an uncommitted cache.
    signal.throwIfAborted()
    await complete.put(
      READY,
      new Response(
        JSON.stringify({
          packId: p.id,
          version: m.contentVersion,
          bytes: p.bytes,
          savedAt: new Date().toISOString(),
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    )
    promoted = true
    // Keep previous complete generations. They can serve open sessions and provide rollback.
    return final
  } finally {
    await caches.delete(staging)
    if (!promoted) await caches.delete(final)
  }
}
export async function verifyPack(
  m: Manifest,
  p: Pack,
  name: string,
  onProgress: (done: number, total: number) => void,
) {
  const cache = await caches.open(name)
  let n = 0
  for (const key of p.artifacts) {
    const a = m.artifacts[key],
      r = await cache.match(a.url)
    if (!r || (await digest(new Uint8Array(await r.arrayBuffer()))) !== a.sha256)
      throw new Error('Missing or corrupt file: ' + key + '. Choose Repair.')
    onProgress(++n, p.artifacts.length)
  }
  return true
}
export async function removePack(name: string) {
  if (!name.startsWith('parallel-pack-')) throw new Error('Invalid pack')
  return caches.delete(name)
}
