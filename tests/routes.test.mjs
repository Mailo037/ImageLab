import assert from "node:assert/strict";
import test from "node:test";

const createWorker = async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
};

const environment = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};

const context = { waitUntil() {}, passThroughOnException() {} };

test("renders direct tool and Settings routes as their matching ImageLab views", async () => {
  const worker = await createWorker();
  const updates = await worker.fetch(new Request("http://localhost/settings/updates", { headers: { accept: "text/html" } }), environment, context);
  const pixelate = await worker.fetch(new Request("http://localhost/tools/pixelate", { headers: { accept: "text/html" } }), environment, context);

  assert.equal(updates.status, 200);
  assert.equal(pixelate.status, 200);
  assert.match(await updates.text(), /Updates/);
  assert.match(await pixelate.text(), /Pixelate/);
});
