import assert from "node:assert/strict";
import test from "node:test";
import { checkForUpdates, compareVersions, parseSemver } from "../app/lib/updates.ts";

const release = (tag: string, body = "Small improvements.") => new Response(JSON.stringify({
  tag_name: tag,
  name: `ImageLab ${tag}`,
  body,
  html_url: `https://github.com/Mailo037/ImageLab/releases/tag/${tag}`,
  published_at: "2026-08-11T00:00:00.000Z",
}), { status: 200, headers: { "content-type": "application/json" } });

test("parses supported semantic versions", () => {
  assert.deepEqual(parseSemver("v1.10.0"), { major: 1, minor: 10, patch: 0, prerelease: null });
  assert.equal(parseSemver("1.0"), null);
  assert.equal(parseSemver("version 1.0.0"), null);
});

test("compares patch, minor, and major versions numerically", () => {
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.1", "1.0.0"), 1);
  assert.equal(compareVersions("1.10.0", "1.9.0"), 1);
  assert.equal(compareVersions("2.0.0", "1.99.99"), 1);
  assert.equal(compareVersions("0.9.0", "1.0.0"), -1);
  assert.equal(compareVersions("broken", "1.0.0"), null);
});

test("reports an available update for a newer stable release", async () => {
  const result = await checkForUpdates({
    currentVersion: "1.0.0",
    releaseUrl: "https://updates.example/latest",
    fetcher: async () => release("v1.1.0", "Faster previews."),
    online: true,
  });
  assert.equal(result.status, "available");
  assert.equal(result.latest.version, "1.1.0");
});

test("reports current for the same or older remote release", async () => {
  const current = await checkForUpdates({ currentVersion: "1.2.0", releaseUrl: "https://updates.example/latest", fetcher: async () => release("v1.2.0"), online: true });
  const older = await checkForUpdates({ currentVersion: "1.2.0", releaseUrl: "https://updates.example/latest", fetcher: async () => release("v1.1.9"), online: true });
  assert.equal(current.status, "current");
  assert.equal(older.status, "current");
});

test("keeps offline and network failures contextual", async () => {
  let called = false;
  const offline = await checkForUpdates({
    currentVersion: "1.0.0",
    releaseUrl: "https://updates.example/latest",
    fetcher: async () => { called = true; return release("v1.0.1"); },
    online: false,
  });
  const failure = await checkForUpdates({
    currentVersion: "1.0.0",
    releaseUrl: "https://updates.example/latest",
    fetcher: async () => { throw new Error("Network unavailable"); },
    online: true,
  });
  assert.equal(offline.status, "offline");
  assert.equal(called, false);
  assert.equal(failure.status, "error");
});

test("rejects malformed latest release metadata", async () => {
  const result = await checkForUpdates({
    currentVersion: "1.0.0",
    releaseUrl: "https://updates.example/latest",
    fetcher: async () => release("not-a-version"),
    online: true,
  });
  assert.equal(result.status, "error");
});

