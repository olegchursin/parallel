# Parallel — World History Atlas

A locally runnable, source-backed **research preview** with 150 events/processes, 25 entities, 15 periods, six journeys, and 142 source records. Historical coverage ends on **31 December 2025**. Source passages were inspected during development; independent historical review remains pending. No record is represented as independently reviewed or published.

## Run it

The project uses **Bun 1.4.2**, installed locally under `.tools/`. Your global Bun installation is unchanged.

```sh
./scripts/setup.sh
./scripts/bun run dev          # http://127.0.0.1:3000
```

For the production application build and offline features:

```sh
./scripts/bun run build
./scripts/bun run preview      # http://127.0.0.1:4173
```

Open **Downloads** and download Starter, an era, a journey, or the complete text atlas before going offline. Install from the browser when supported. Service workers are enabled only in production builds, over HTTPS or localhost. A development server is not an offline test.

## Commands

| Command, following `./scripts/bun run` | Purpose                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `dev`                                  | Compile content and run Vite development server                                                                      |
| `build`                                | Compile content, build Start, prerender every eligible content page, inject the service-worker precache              |
| `preview`                              | Serve `dist/client` with correct MIME types, caching and real missing-file errors                                    |
| `content:validate`                     | Validate schemas, citations, references, chronology, review gates and corrections without writing                    |
| `content:build`                        | Produce immutable content artifacts and generated route list                                                         |
| `content:report`                       | Recompile and produce `docs/reports/coverage.json`                                                                   |
| `typecheck`                            | Check TypeScript                                                                                                     |
| `lint`                                 | Check the browser/authoring boundary and prohibited runtime behavior                                                 |
| `test`                                 | Chronology, content, URL state, bookmarks and synthetic-corpus tests                                                 |
| `test:install`                         | Install pinned Playwright browser engines                                                                            |
| `test:e2e`                             | Chromium, Firefox and WebKit production-browser tests                                                                |
| `test:performance`                     | Browser benchmark with a separate 5,000-record in-memory fixture; starts a local preview if needed                   |
| `verify:release`                       | Typecheck, architecture checks, unit tests, build, artifact/budget checks, browser tests and performance measurement |
| `build:published`                      | Build only records with `published` status; currently produces an empty historical corpus                            |
| `format`                               | Format application, scripts, tests and documentation                                                                 |

Run `./scripts/bun run test:install` once before browser verification. Node 22.12+ is needed by the build/test toolchain; development was verified with Node 24.18.0. `bun.lock` pins the dependency graph.

## What works

- Shared linear timeline across ten expandable regional lanes, period bands, duration marks, uncertainty indicators, deterministic clusters, overview navigation, explicit date controls and drag/keyboard pan/zoom.
- Reorder lanes with drag-and-drop or arrow buttons. Compare up to three lanes; order and filters survive mode changes. Mobile first visits default to Read, with Atlas always available.
- Paginated Read mode exposes every filtered record. Filters use OR within a group and AND between groups.
- Search titles, summaries, aliases, places, regions and themes; explicit BCE/CE or BC/AD date searches; bounded single-edit fuzzy matching for longer terms.
- Event drawers with focus restoration, standalone records, claim-level citations, source pages, cited relationships, entity phases and clearly labeled temporal comparisons.
- Six guided journeys with local reading progress; bookmarks with validated merge/replace import and JSON export.
- Version-pinned, integrity-checked text packs with progress, cancellation, verification, repair and removal. Updates require an explicit action; prior complete generations and shell caches are retained for other tabs.
- Light, dark, system and high-contrast appearances. No external fonts or required image requests.

## Content and architecture

Canonical JSON lives in `content/`. Zod contracts and pure chronology functions live in `src/lib/`. The compiler produces SHA-256-addressed manifests, indexes, detail shards, relationships, pack definitions and generated JSON schemas. Browser code reads these through the same typed adapter used by prerendering; it never imports authoring files or filesystem APIs.

`content/config.json` **explicitly enables preview content**. `CONTENT_MODE=production` overrides it and admits only published records. A production-optimized software build and an editorially published corpus are different things. Candidates, drafts, unused sources, private research working files and synthetic data are excluded from output. Every build clears the generated public content directory before writing its selected release, preventing preview artifacts from leaking into a published-only build.

There is no database, application IndexedDB, account system, analytics, hosted search, runtime AI or backend service. Cache Storage holds downloaded files; versioned localStorage holds only preferences, journey positions and bookmarks. Longer prose uses a restricted, non-executable Markdown renderer.

## Read before publishing

- [Editorial status and coverage](docs/EDITORIAL.md)
- [Source inspection ledger](docs/SOURCE-CHECKS.md)
- [Architecture and dependency decisions](docs/ARCHITECTURE.md)
- [Deployment and rollback](docs/DEPLOYMENT.md)
- [Verification and device limits](docs/VERIFICATION.md)
- [Generated coverage report](docs/reports/coverage.json)
- [Generated release and transfer report](docs/reports/release.json)
- [Generated browser performance report](docs/reports/performance.json)
- [Browser verification summary](docs/reports/tests.json)

Maps, poster exports, translations, tradition overlays, accounts and a 1,200-record corpus are deferred. This delivery does not deploy to a hosting provider. Physical devices, installed Safari/Android PWAs and field performance remain separate verification tasks.
