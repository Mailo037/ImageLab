import { readFile } from "node:fs/promises";

const tag = process.argv[2];
const version = tag?.replace(/^v/, "");
if (!version) throw new Error("Pass a release tag such as v1.2.0.");

const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const heading = new RegExp(`^## ${version.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(?:\\s|—|-).*$`, "m");
const match = heading.exec(changelog);
if (!match || match.index === undefined) {
  throw new Error(`CHANGELOG.md has no section for ${version}.`);
}

const start = match.index + match[0].length;
const next = changelog.slice(start).search(/^## /m);
const notes = changelog.slice(start, next < 0 ? undefined : start + next).trim();
if (!notes) throw new Error(`CHANGELOG.md section for ${version} is empty.`);
process.stdout.write(`${notes}\n`);
