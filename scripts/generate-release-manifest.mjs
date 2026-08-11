import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const write = (path, value) => writeFile(new URL(path, root), value, "utf8");

const packageJson = JSON.parse(await read("package.json"));
const version = packageJson.version;
const repository = typeof packageJson.repository === "string" ? packageJson.repository : packageJson.repository?.url;
const repositoryUrl = repository?.replace(/^git\+/, "").replace(/\.git$/, "") ?? "https://github.com/Mailo037/ImageLab";
const releaseUrl = `${repositoryUrl}/releases/tag/v${version}`;

const manifest = {
  channel: "stable",
  version,
  releaseUrl,
  repository: repositoryUrl,
};

const serviceWorkerTemplate = await read("public/sw.template.js");
const serviceWorker = serviceWorkerTemplate.replaceAll("__IMAGELAB_VERSION__", version);

await Promise.all([
  write("public/release.json", `${JSON.stringify(manifest, null, 2)}\n`),
  write("public/sw.js", `/* Generated from public/sw.template.js. Do not edit directly. */\n${serviceWorker.trimEnd()}\n`),
]);
