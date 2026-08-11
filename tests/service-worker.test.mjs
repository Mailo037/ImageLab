import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const templateUrl = new URL("../public/sw.template.js", import.meta.url);

const loadWorker = async ({ fetcher, match = async () => undefined } = {}) => {
  const listeners = new Map();
  const cache = {
    add: async () => undefined,
    put: async () => undefined,
  };
  const context = {
    URL,
    Response,
    Promise,
    self: {
      location: { origin: "https://imagelab.test" },
      clients: { claim: async () => undefined },
      skipWaiting: () => undefined,
      addEventListener: (type, listener) => listeners.set(type, listener),
    },
    caches: {
      open: async () => cache,
      match,
      keys: async () => [],
      delete: async () => false,
    },
    fetch: fetcher ?? (async () => new Response("ok")),
  };
  const source = (await readFile(templateUrl, "utf8")).replaceAll("__IMAGELAB_VERSION__", "test");
  vm.runInNewContext(source, context, { filename: "sw.template.js" });
  return listeners;
};

const dispatchFetch = (listener, request) => {
  let response;
  listener({
    request,
    respondWith: (value) => { response = Promise.resolve(value); },
    waitUntil: () => undefined,
  });
  return response;
};

test("returns an offline document instead of rejecting a failed deep-link navigation", async () => {
  const listeners = await loadWorker({ fetcher: async () => { throw new TypeError("Failed to fetch"); } });
  const response = await dispatchFetch(listeners.get("fetch"), {
    method: "GET",
    mode: "navigate",
    url: "https://imagelab.test/settings/updates",
  });

  assert.equal(response.status, 503);
  assert.match(await response.text(), /ImageLab is offline/);
});

test("returns a normal offline response for a failed uncached asset request", async () => {
  const listeners = await loadWorker({ fetcher: async () => { throw new TypeError("Failed to fetch"); } });
  const response = await dispatchFetch(listeners.get("fetch"), {
    method: "GET",
    mode: "cors",
    destination: "script",
    url: "https://imagelab.test/assets/editor.js",
  });

  assert.equal(response.status, 504);
});
