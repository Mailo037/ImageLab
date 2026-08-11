# Update architecture

ImageLab is a web/PWA application, so an update is not a desktop executable download. The update flow separates three facts that may change independently:

1. **Running application version** — derived once from `package.json` at build time and exposed through `app/lib/version.ts`.
2. **Latest stable release** — optional public GitHub Releases metadata fetched by `app/lib/updates.ts`.
3. **Prepared application assets** — a waiting service worker detected by `app/lib/service-worker.ts`.

The editor does not depend on GitHub for normal image processing. A failed release lookup, offline browser, rate limit, or unavailable repository only affects the contextual update status.

## Check flow

Settings → Updates invokes two independent checks:

```text
current APP_VERSION
  → GitHub latest stable release metadata
  → semantic version comparison

current service-worker registration
  → registration.update()
  → waiting worker, if new assets are already available
```

Versions are parsed numerically, not compared as strings, so `1.10.0` correctly sorts after `1.9.0`. Draft and prerelease release metadata are ignored for the stable channel.

Automatic checks are opt-in through the local Settings preference, run after launch, and are limited by a six-hour local timestamp. No workspace or image data is included in a request.

## Applying a prepared update

The generated service worker intentionally does **not** call `skipWaiting()` during install. This prevents an active editor from being reloaded behind the user's back.

When the user chooses **Update now**:

1. ImageLab refuses while a batch export is in progress.
2. It writes a short-lived local workspace snapshot to IndexedDB, with a session-storage fallback for non-file state.
3. It asks the waiting worker to activate through `IMAGELAB_SKIP_WAITING`.
4. It waits for `controllerchange`, then reloads the editor route.
5. The new app consumes the local snapshot once and restores it where browser storage permits.

The snapshot expires after 30 minutes. It includes files only when IndexedDB can structured-clone them; the fallback preserves settings and operation state but not raw file bytes. Imported files remain local at every stage.

## Offline failure behavior

The service worker must always settle a fetch event with a `Response`. A failed uncached navigation first falls back to its cached route, then the cached application shell, and finally a small `503` offline document. A failed uncached asset request returns a normal `504` offline response instead of rejecting the fetch event. This prevents a transient network failure from surfacing as an unhandled service-worker promise or a browser-level network-error response.

Shell pre-caching is best effort: one unavailable shell asset must not prevent a new worker from installing. Successful later responses are still cached opportunistically.

## Generated assets

`public/sw.template.js` is the human-maintained source. `npm run generate:release` produces these checked-in artifacts:

- `public/sw.js`, versioned cache namespace and update activation protocol;
- `public/release.json`, stable channel/version/repository metadata.

Keeping the generated result in the release commit makes the deployed asset version inspectable and prevents version strings from drifting across the UI, service worker, and public metadata.
