import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const componentSourceUrl = new URL("app/components/image-lab.tsx", root);
const designSystemUrl = new URL("docs/DESIGN_SYSTEM.md", root);

const catalog = [
  "Button",
  "IconButton",
  "ImageLabTooltip",
  "ImageLabSelect",
  "ImageLabNumberInput",
  "ImageLabSlider",
  "ImageLabColorField",
  "ImageLabSwitch",
  "ImageLabCheckbox",
  "ImageLabDisclosure",
  "ImageLabProgress",
  "PalettePanel",
  "EditorEmpty",
  "Queue",
  "List",
  "ImageLabContextMenu",
  "ImageLabDialog",
];

test("design-system catalog names real exported ImageLab components", async () => {
  const [source, documentation] = await Promise.all([
    readFile(componentSourceUrl, "utf8"),
    readFile(designSystemUrl, "utf8"),
  ]);

  for (const component of catalog) {
    assert.match(source, new RegExp(`export function ${component}\\b`), `${component} must remain a real shared export`);
    assert.ok(documentation.includes(`### \`${component}\``), `${component} must remain documented`);
  }
});

test("documented design-system source and showcase paths exist", async () => {
  await Promise.all([
    access(new URL("AGENTS.md", root)),
    access(componentSourceUrl),
    access(new URL("app/globals.css", root)),
    access(new URL("app/dev/design-system/page.tsx", root)),
    access(new URL("app/dev/design-system/showcase.tsx", root)),
  ]);
});
