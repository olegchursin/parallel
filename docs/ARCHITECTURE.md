# Architecture and dependency decisions

## Exact dependency baseline

The requested versions resolve and were verified together through a production build: TanStack Start 1.168.58, Router 1.170.39, React/React DOM 19.3.0, Vite 8.3.1, React Vite plugin 6.1.1 and Zod 4.6.5. Bun 1.4.2 is project-local and `bun.lock` is checked in. The global Bun installation is untouched. TypeScript 7.0.2 checks application and build code. Playwright 1.63.0 supplies Chromium, Firefox and WebKit; Vitest 5.0.2 runs pure-function and content tests. Workbox 7.4.1 packages the custom worker, lucide-react supplies code-native icons, and Prettier 3.6.2 formats source. `jsonc-parser` is used with comments/trailing commas disabled to detect duplicate JSON keys.

TanStack Start is configured using its [SPA mode](https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/spa-mode.md) and [static prerendering](https://github.com/TanStack/router/blob/main/docs/start/framework/react/guide/static-prerendering.md) interfaces. These documented interfaces were also checked against installed package code.

## Static delivery

1. Validate canonical UTF-8 JSON and all references, dates and publication gates.
2. Canonicalize the eligible corpus, including corrections, compiler/chronology/schema/taxonomy fingerprints, lockfile and optional build commit, and derive its immutable content version. Compiler or metadata changes therefore cannot silently change bytes at an existing version URL.
3. Emit a small catalog, search index, eight-record detail shards, per-record entity/journey/source files, place and relationship indexes, pack definitions, and a manifest containing decoded-byte sizes and SHA-256 digests.
4. Emit a release pointer and an explicit list of every eligible static route.
5. Build Start and prerender the enumerated pages. The SPA mask is `/offline`, producing `/_shell.html`; using `/` as the mask conflicts with the separately prerendered landing page in this version, so a separate mask avoids that collision.
6. Bundle the custom service worker and run Workbox `injectManifest` **after** all output files exist.

The browser entry embeds only the release pointer, not the authoring tree. `createIsomorphicFn` gives the content adapter a server filesystem transport and a browser fetch transport. Both verify the same content hashes. Prerendered pages contain their actual reading text, not just an empty mounting point.

Query-dependent views hydrate with the canonical prerendered state, then apply the browser's validated query through React's hydration-aware external-store hook. This lets one static document serve arbitrary shared filters without hydration errors; updates still merge against the actual URL state.

Build timestamps are deterministic metadata, not editorial review dates. Record IDs are opaque and stable; slugs can change without breaking IDs. Generated files are ignored in Git and rebuilt from canonical sources. Source files are pretty-printed JSON, one record per file.

## Chronology and presentation

Chronology uses integer astronomical years and proleptic Gregorian ordinal days, with 1970-01-01 as ordinal zero. The civil conversion uses an era/400-year decomposition with floor division for negative years. Historical labels never display year zero. Browser `Date` is used only for present-day bookmark/download timestamps.

Point precision envelopes, genuine spans, unknown ends, ongoing spans and correlated alternatives remain distinct. Dates retain their original expression, calendar provenance, qualifier and claim references. Uncalibrated BP placement is rejected. A source-native “years ago” label is shown for deep-time records; coarse anchors and their limits are explained in the record, rather than displayed as exact ancient calendar dates.

All lanes use the same ordinal-to-pixel projection. Buckets are deterministic and density-sensitive, selected records stay separate, and Read mode keeps every matching record accessible. Period bands are clipped to the viewport, not omitted when their starts lie outside it. Long event processes also have duration marks. Expansion reveals the subregions represented by the current records. There is no fixed historical hierarchy implied by the lane order.

URL schema 1 validates `v`, `from`, `to`, `regions`, `themes`, `view`, `selected`, `q` and `density`. Pan/zoom replaces settled history entries; deliberate selections and mode changes push entries. Transient pointer and download state remain local. Dates use explicit BCE/CE grammar; bare negative numbers do not silently become historical BCE years. Supported query strings remain well below 2,000 characters.

Search is local and deterministic. It normalizes case and accents and permits one edit for query tokens of at least five characters. The full preview index is searchable offline after a pack download; a result may require another pack for its full text. A synthetic 5,000-record fixture exists only under tests and temporary build output.

## Offline transaction model

A pack download creates an isolated staging cache. Each response must be JSON, match its manifest byte count, and match its SHA-256 digest. The manifest is checked too. After copying to a new final-generation cache, a completion marker is written last. Readers ignore staging and unmarked final caches. Cancellation, network errors, quota errors and digest failures delete the incomplete generation and leave earlier complete generations intact.

The worker searches complete generations newest first. Repair fetches bypass Cache Storage. Verification explicitly checks cached bytes. Removal deletes only the chosen pack's complete generations; it does not clear bookmarks or unrelated packs. Browser-managed HTTP caching may additionally retain visited resources, but it never substitutes for the ready marker or the pack integrity contract.

Every app bundle pins a content release. Merely fetching a newer release pointer does not switch loaders. An update banner offers explicit activation/reload. Each worker build has a separate shell cache namespace. Previous complete content and shell caches are conservatively retained rather than guessing that no open tab needs them. There is no automatic cross-tab garbage collection. Users can remove older content versions from Downloads; old shell caches can be removed after all older tabs are closed by clearing site storage (export bookmarks first).

Service-worker networking does not turn missing JSON/JS into HTML. The production preview uses an allowlist for interactive fallbacks and real 404 responses for absent content files. Its CSP allows Start's inline hydration script and inline layout coordinates; historical Markdown never becomes raw HTML. A deployment can tighten script policy using generated hydration-script hashes after verifying its build output.

## Deliberate implementation choices

- The preview is smaller and more selective than the planned full release. Entity and period records describe specifically sourced phases; they do not claim complete political lifespans.
- Detail shards are much smaller than the proposed 100–250 KB compressed _upper sizing range_. With only eight records per shard, precise offline selection is more useful than artificially filling a shard.
- The catalog is small enough to hydrate for accessible initial navigation; full detail/source text remains separately loaded.
- The comparison limit is three lanes on both desktop and mobile. Normal Atlas mode exposes all ten.
- Source website contents are linked, not downloaded or mirrored. Only original summaries and citation metadata are bundled.
