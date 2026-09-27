# Verification and limits

The release gate is executable with `./scripts/bun run verify:release`. It checks the actual static production output, not the development server. Generated reports record the content version and measured sizes; browser traces and the HTML test report are under ignored test-output directories.

## Automated checks

- **18 unit/content tests**: known Gregorian epoch/leap fixtures; BCE/CE with no displayed year zero; negative-year round trips; uncertainty, actual duration, exclusive boundaries, unknown/ongoing ends, alternative chronologies, uncalibrated BP rejection and projection inversion. Content tests cover deterministic output, references, all requested counts, preview/publication separation, duplicate JSON keys, filter groups, URL round trips, validated bookmark import and a separate 5,000-record fixture.
- **72 production-browser cases** across Chromium, Firefox and WebKit: search to detail/source, deep refresh, query-link hydration without runtime errors, URL/history/mode preservation, aligned comparison tracks, clusters, lane expansion/reordering, drawer focus restoration, bookmarks, journeys, missing files, responsive layout, light/dark/high-contrast accessibility, keyboard pan and zoom-equivalent layout.
- **Offline and update cases in all three engines**: complete pack, offline shell/deep-link/source/search reopening, cancelled replacement, missing shard, corrupt cached file, corrupt replacement, quota exhaustion before and during writing, pack removal, two-tab content pinning, explicit worker activation and retention of the older shell cache.
- **Static artifact checks**: 257 prerendered application/content pages, plus the SPA shell; 150 hashed content artifacts; matching decoded-byte lengths and SHA-256 digests; no stale content-version directories; required icons/manifest/worker; real errors for missing JSON/JS.
- **Published-only isolation build**: independently built and checked with `CONTENT_MODE=production`; no historical records or bibliographic source records pass while independent review is pending. [Isolation report](reports/published-isolation.json).

Axe checks use WCAG 2 A/AA and 2.1 AA rules. Tested CSS viewports are 320, 390, 768 and 1440 pixels. A 720-pixel CSS viewport checks the layout equivalent of a 1440-pixel desktop browser at 200% zoom; it does not substitute for physical-device zoom testing.

### WebKit offline-test distinction

Playwright 1.63 has a reported [WebKit offline-emulation issue](https://github.com/microsoft/playwright/issues/42775): `setOffline(true)` can reject service-worker navigations even when a worker returns a literal response. The suite therefore uses an isolated static origin and destroys **all incoming origin connections** after downloads are ready. Chromium and Firefox additionally use browser offline emulation. WebKit uses origin unavailability to exercise the real worker/cache path. This is recorded as a distinct test method, not a claim of physical iPhone airplane-mode verification.

The update fixture serves a changed worker namespace and a simulated newer release pointer from a separate local origin. It verifies an actual waiting-worker activation, reload, old-cache retention and an unchanged content pin in a second tab. It does not publish or fabricate a second historical corpus.

## Measurements

See [release.json](reports/release.json) for current byte counts. The full set of JavaScript route chunks is approximately **171 KB gzip**, CSS **11 KB**, the overview **20 KB**, and the search index **12 KB**. Summed compressed text artifacts are approximately **174 KB**; the complete text download reports approximately **724 KB of decoded bytes**. The conservative landing estimate, counting every JavaScript route chunk, is about **223 KB gzip**, within the 1 MB target. No fonts or remote media are required.

Eight-record detail shards are around 4 KB compressed at their largest. That is below the PDF's proposed shard sizing range, deliberately: the small preview benefits from finer offline selection rather than padding bundles. Hashes and offline estimates use decoded bytes, independent of a host's gzip/Brotli settings.

The browser stress test creates 5,000 synthetic copies **only in memory through a temporary test entry**. It measures filtering/search and deterministic clustering, verifies that all 5,000 records remain accessible, and enforces a median search time below 100 ms on the local desktop browser. The measured environment and raw numbers are in [performance.json](reports/performance.json). This is not a real midrange phone, a throttled mobile measurement, or field p75 Web Vitals.

## Visual and keyboard inspection

Desktop landing and atlas screenshots and mobile Read layouts were visually inspected during development. Screenshots at all four required widths are retained in `docs/screenshots/`. Browser tests exercise native dialog focus, Escape restoration, keyboard timeline controls, mobile view selection, reflow and appearance settings. They do not claim screen-reader certification.

## Not verified with physical devices

- Installed iOS Safari PWA launch, storage eviction, share-sheet installation and airplane-mode reopening.
- Installed Android Chrome PWA behavior, back gestures and device storage pressure.
- Real-device 60 fps pan/zoom and under-two-second offline reopening.
- Real screen-reader sessions, OS text enlargement and physical-device pinch/browser zoom.
- Field p75 LCP, INP and CLS (the local lab report is only a proxy).
- A live hosting provider's cache headers, atomic deployment and production rollback; no hosting deployment was requested.
- Independent historical review and systematic independent-source corroboration.

These remain explicit release limits. The current application is suitable for local evaluation as a research preview, not for presenting its corpus as an independently reviewed publication.
