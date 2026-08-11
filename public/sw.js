/* Generated from public/sw.template.js. Do not edit directly. */
const APP_VERSION = "1.0.0";
const CACHE = `imagelab-shell-v${APP_VERSION}`;
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/release.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.allSettled(SHELL.map((path) => cache.add(path)))).then(() => undefined),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "IMAGELAB_SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("imagelab-shell-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  const cacheResponse = (response) => {
    if (!response.ok) return response;
    const copy = response.clone();
    event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined));
    return response;
  };

  const offlineDocument = () => new Response(
    "<!doctype html><title>ImageLab is offline</title><meta name=viewport content='width=device-width,initial-scale=1'><p>ImageLab is offline. Reconnect and try again.</p>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return cacheResponse(await fetch(request));
      } catch {
        return await caches.match(request) || await caches.match("/") || offlineDocument();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (request.destination === "script" || request.destination === "style" || request.destination === "image" || request.destination === "font") return cacheResponse(response);
      return response;
    } catch {
      return new Response("", { status: 504, statusText: "Offline", headers: { "Cache-Control": "no-store" } });
    }
  })());
});
