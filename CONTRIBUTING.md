# Contributing to ImageLab

Thanks for helping make a useful local-first image utility.

## Development

1. Fork and clone the repository.
2. Run `npm install`.
3. Start the app with `npm run dev`.
4. Make a focused change and verify it with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.

## Design and privacy principles

- Read [AGENTS.md](AGENTS.md) and the canonical [ImageLab design system](docs/DESIGN_SYSTEM.md) before changing shared UI. Inspect the live `/dev/design-system` route during local development.
- Keep normal image processing in the browser. Do not introduce network uploads for a convenience feature.
- Prefer built-in browser APIs and defer heavyweight dependencies until a tool needs them.
- Keep controls functional, keyboard reachable, labelled, and useful at compact viewport sizes.
- Show measured progress or an indeterminate state only when the browser cannot expose real progress.
- Avoid generic dashboard UI, status badges, and decorative controls that do not serve the workflow.
- Keep Settings entries in `app/lib/settings-registry.ts` so Settings search and the command palette share the same source of truth.
- Treat the original `File` as immutable. New editing capabilities should add non-destructive operation configuration and preserve undo/redo behavior.
- Before creating a component, search the current ImageLab primitives and extend an existing interaction when possible. Add genuine new primitives to both the design-system document and development showcase.

## Adding a tool

1. Add one entry to `app/lib/tools.ts`. Define its id, category, route, capabilities, supported formats, settings, and processor kind.
2. Reuse an existing mode in `ToolPanel` when possible. Add a narrow mode only when settings or interactions genuinely differ.
3. Add the rendering behavior in `app/lib/processor.ts`, preserving cancellation checks and ImageBitmap cleanup.
4. Verify an imported image, a preview, an export, and the related `/tools/<id>` route.
5. Update the relevant architecture document if the extension changes the contract.

## Versions and releases

- `package.json` is the one canonical application version. Use semantic versions only.
- `npm run generate:release` derives `public/release.json` and `public/sw.js`; do not edit the generated service worker directly.
- A stable release is created by pushing an annotated `vMAJOR.MINOR.PATCH` tag after CI is green. The GitHub release workflow validates that the tag and package version match before publishing notes.
- Do not add runtime network dependencies to normal image editing. Update checks may use public release metadata, but they must continue to fail gracefully offline.

## Pull requests

Use a clear title, explain the user-visible effect, call out browser support constraints, and include testing notes. Keep unrelated reformatting out of feature pull requests whenever possible. If a change affects local workspace persistence, updates, or offline behavior, call that out explicitly.

By contributing, you agree that your contributions are licensed under the MIT License.
