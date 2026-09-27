import { filterEvents, clusterEvents, DEFAULTS } from '../src/lib/state'
import { ordinal } from '../src/lib/chronology'
import type { EventIndex } from '../src/lib/schema'
// This entry is built only into tmp/ and injected by a test. Never imported by the app.
export function benchmark(seed: EventIndex[]) {
  const corpus = Array.from({ length: 5000 }, (_, i) => ({
    ...seed[i % seed.length],
    id: 'synthetic_' + String(i).padStart(5, '0'),
  }))
  const runs: number[] = []
  let selected: EventIndex[] = []
  for (let i = 0; i < 20; i++) {
    const before = performance.now()
    selected = filterEvents(corpus, { ...DEFAULTS, from: '300000BCE', to: '2026CE', q: 'water' })
    runs.push(performance.now() - before)
  }
  const before = performance.now(),
    all = filterEvents(corpus, { ...DEFAULTS, from: '300000BCE', to: '2026CE' })
  const groups = clusterEvents(all, ordinal(-299999), ordinal(2026), 1000, 'balanced')
  return {
    records: corpus.length,
    matching: selected.length,
    searchMedianMs: runs.sort((a, b) => a - b)[10],
    searchMaxMs: Math.max(...runs),
    filterAndClusterMs: performance.now() - before,
    clusters: groups.length,
    accessibleRecords: groups.flatMap((c) => c.events).length,
  }
}
;(window as unknown as { parallelBenchmark: typeof benchmark }).parallelBenchmark = benchmark
