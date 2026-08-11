# ImageLab

ImageLab is a local-first, browser-based image editing toolkit. It is built as a focused workspace for editing, transforming, optimizing, converting, inspecting, and exporting images without normal image uploads to a remote service.

Normal processing happens in the browser. Once its application shell has been cached, ImageLab remains usable offline for its local editing workflow.

## Local-first by default

- Imported images, previews, edits, exports, palette extraction, and metadata inspection stay in the browser during normal use.
- ImageLab does not send image data, filenames, edit history, recent files, or tool usage when it checks for an application update.
- Recent sessions and preferences are stored locally on the device. ImageLab does not represent them as cloud storage.

## Features

- Unified responsive editing workspace with zoom, pan, comparison, undo/redo, contextual actions, and a compact file filmstrip.
- Drag-and-drop, multi-file picker, clipboard import, batch selection, inline retries, measured progress, cancellation, individual downloads, and ZIP export.
- Non-destructive operation stack for crop, resize, rotation, color adjustments, effects, masks, text, borders, and background treatments.
- Browser-native Canvas processing for conversion, compression, target-size encoding, transparency tools, creative tools, favicon generation, palette extraction, and local metadata inspection.
- Dedicated tool routes, settings routes, persistent local preferences/favorites, a service worker, and stable semantic application versioning.

## Getting started

Requirements: Node.js 22.13 or newer and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Verification and production builds

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run build` regenerates the release manifest and service-worker metadata from the canonical package version before producing the deployment artifact.

`npm test` also prepares a production artifact so route tests exercise the built application.

## Project structure

```text
app/
  components/image-lab.tsx     unified local editing workspace
  dev/design-system/           development-only live component reference
  lib/tools.ts                 central tool registry, categories, routes, capabilities
  lib/processor.ts             Canvas processing primitives and encoders
  lib/updates.ts               semantic version comparison and release lookup
  lib/service-worker.ts        service-worker update coordination
  lib/settings-registry.ts     addressable settings search index
  settings/                    Settings and Settings-section routes
  tools/[tool]/                shareable editor routes
public/
  sw.template.js               versioned service-worker source template
  sw.js                        generated service worker checked into releases
  release.json                 generated stable-release metadata
docs/
  DESIGN_SYSTEM.md
  tool-architecture.md
  processing-architecture.md
  update-architecture.md
  releases.md
```

Start with [AGENTS.md](AGENTS.md) for the repository contract. See the [design system](docs/DESIGN_SYSTEM.md), [tool architecture](docs/tool-architecture.md), [processing architecture](docs/processing-architecture.md), [update architecture](docs/update-architecture.md), and [release guide](docs/releases.md) for focused extension and maintenance details. During local development, `/dev/design-system` renders the real reusable UI components and their important states.

## Browser support and format notes

ImageLab uses `createImageBitmap`, Canvas, Blob URLs, File APIs, the Clipboard API when available, and browser-native encoders. PNG, JPEG, WebP, BMP, and ICO work broadly in current evergreen browsers. AVIF encoding and decoding depend on the active browser codec. SVG import is rasterized locally when the browser can decode it.

Canvas exports intentionally remove embedded metadata, which makes Strip Metadata reliable and local. Browser image APIs may decode animated formats as a still frame.

## Versioning and releases

ImageLab follows semantic versioning (`MAJOR.MINOR.PATCH`). The canonical version is `package.json`; build metadata is derived from it at build time. Stable GitHub releases use tags such as `v1.0.0` and are published by the release workflow after checks pass.

The in-app update area checks only public GitHub release metadata and the browser's service-worker state. It never automatically reloads an active editor. When a prepared update is explicitly applied, the app stores a short-lived local workspace snapshot and restores it after reload where the browser permits it.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), keep processing local by default, and add registry, processor, and test coverage when introducing a tool or maintenance capability.

## License

[MIT](LICENSE) © ImageLab contributors.
