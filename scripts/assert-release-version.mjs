import { readFile } from "node:fs/promises";

const tag = process.argv[2];
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z.-]+)?$/;

if (!tag || !tag.startsWith("v") || !semver.test(tag.slice(1))) {
  throw new Error(`Expected a semantic release tag such as v1.2.0; received ${tag ?? "nothing"}.`);
}

if (tag.slice(1) !== packageJson.version) {
  throw new Error(`Tag ${tag} does not match package.json version ${packageJson.version}.`);
}
