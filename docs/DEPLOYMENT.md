# Deployment and rollback

No hosting deployment is part of this delivery. The application is a static artifact in `dist/client`; the Start server output is a build/prerender tool, not a required production backend.

## Prepare a release

```sh
./scripts/setup.sh
./scripts/bun run test:install
./scripts/bun run verify:release
```

Inspect the generated coverage, release, test and performance reports. Confirm the intended editorial mode. The supplied configuration explicitly permits evidence-checked research-preview records. Use `./scripts/bun run build:published` only for a published-only corpus; it intentionally excludes the current pending-review records.

Deploy the **whole** `dist/client` release atomically. HTML, JavaScript, the embedded release pointer, manifests and immutable data must agree. Do not update `data/release.json` alone. Put each release in a separate immutable deployment directory before switching an active alias.

## Static host rules

- Use HTTPS in production. Serve `manifest.webmanifest` as `application/manifest+json`, JSON as `application/json`, JavaScript as `application/javascript`, and CSS/PNG/SVG with their proper types.
- `assets/*` and `data/v-*/*`: `Cache-Control: public, max-age=31536000, immutable`.
- HTML, `sw.js`, `manifest.webmanifest`, `app-version.json` and `data/release.json`: revalidate; do not give them immutable caching.
- Enable gzip or Brotli. The local preview intentionally serves uncompressed bytes; the budget report also measures gzip sizes from those actual bytes.
- Resolve real files first. Use each prerendered directory's `index.html` for its content URL. Interactive routes `/timeline`, `/search`, `/bookmarks`, `/downloads` may fall back to `/_shell.html` if a host requires a fallback.
- Unknown records, absent JSON, absent JavaScript and arbitrary URLs must return a real 404/503, **never the SPA shell**. Avoid blanket `/* -> index.html` rules.
- Preserve security headers from `scripts/serve.ts` or an equivalent reviewed policy. In particular, use `nosniff`, a restrictive default source policy, no frames, and no objects.
- Root-path hosting is the configured default. A subpath deployment needs coordinated router base, manifest scope/start URL, service-worker scope and content URL changes; it is not supported by simply moving the directory.

## Updates and version retention

The app pins its content version per bundle/session. A new pointer or worker produces an explicit update offer; no silent content switch occurs during reading. Applying a worker update asks the waiting worker to activate, then reloads the current tab. Other open tabs keep their loaded bundle and content pin.

Keep the prior release's immutable assets and `data/v-*` directory available while old tabs can still request them. A deployment archive should retain at least the previous complete release and, when old sessions remain in use, older referenced versions too. The browser retains complete download generations and worker-specific shell caches conservatively. Do not delete them automatically during deployment.

Build output itself contains only one selected version, so published-only builds cannot accidentally inherit preview data. Retaining older **publicly authorized** deployment versions is a separate hosting decision; never merge a research-preview archive into a published-only release without explicitly authorizing that exposure.

## Rollback

1. Switch the hosting alias back to the archived complete HTML/assets/data release; do not edit historical JSON inside an existing immutable version.
2. Serve the archived worker script and revalidation headers. Existing tabs continue to use their own pins until the user applies the offered update/reload.
3. Confirm a deep event URL, a source URL, search, and the download manifest. Request nonexistent `.json` and `.js` files and verify errors.
4. Confirm downloaded older generations still open with the origin unavailable. A failed new download must not remove the prior completion marker.
5. If a device has corrupt files, use **Verify**, then **Repair / redownload** while online. Repair stages and validates a fresh generation before marking it ready. Remove obsolete generations only after their readers no longer need them.

For a local fresh-start diagnosis, export bookmarks, close other tabs using the site, and clear site storage in browser settings. This removes the shell, downloads and preferences. It is a diagnostic/reset action, not the ordinary update mechanism.

## Local server lifecycle

`./scripts/bun run preview` listens only on `127.0.0.1:4173`. `PORT=4174 ./scripts/bun run preview` selects another port. Stop that terminal process to stop serving. Testing on a physical phone requires a separately configured secure origin reachable by the phone; localhost on a phone refers to the phone itself.
