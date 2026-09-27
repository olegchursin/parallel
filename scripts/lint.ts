import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
async function scan(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await scan(p)))
    else if (/\.(ts|tsx|css)$/.test(p)) out.push(p)
  }
  return out
}
const files = [...(await scan('src')), ...(await scan('scripts'))]
const failures: string[] = []
for (const path of files) {
  if (
    path.includes('generated') ||
    path.includes('routeTree.gen') ||
    path === import.meta.path.replace(process.cwd() + '/', '')
  )
    continue
  const text = await readFile(path, 'utf8')
  if (path.startsWith('src/') && /from\s+['"][^'"]*content\/(events|sources|entities)/.test(text))
    failures.push(path + ': browser code imports authoring data')
  if (path.startsWith('src/') && /dangerouslySetInnerHTML|\beval\(/.test(text))
    failures.push(path + ': executable content sink')
  if (path.startsWith('src/') && /indexedDB\./.test(text))
    failures.push(path + ': application IndexedDB is forbidden')
  if (/TODO|FIXME/.test(text)) failures.push(path + ': unfinished implementation marker')
}
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Architecture checks passed across ${files.length} source files.`)
