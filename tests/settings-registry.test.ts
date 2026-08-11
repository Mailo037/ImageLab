import assert from "node:assert/strict";
import test from "node:test";
import { searchSettings } from "../app/lib/settings-registry.ts";

const ids = (query: string) => searchSettings(query).map((entry) => entry.id);

test("settings search ranks exact and direct matches first", () => {
  assert.equal(ids("theme")[0], "appearance.theme");
  assert.equal(ids("update")[0], "updates.check");
});

test("settings search understands aliases and fuzzy input", () => {
  assert.ok(ids("night mode").includes("appearance.theme"));
  assert.ok(ids("apperance").some((id) => id.startsWith("appearance.")));
  assert.ok(ids("updte").some((id) => id.startsWith("updates.")));
  assert.ok(ids("mem").includes("processing.memory"));
  assert.ok(ids("clear").includes("privacy.clear"));
});

