# ImageLab development contract

This file is the entry point for contributors and coding agents. Preserve ImageLab's existing local-first architecture and visual identity; use the linked documents for detail instead of inventing parallel conventions.

## Read before changing code

Source-of-truth order:

1. Working implementation and tests.
2. Shared ImageLab components in `app/components/image-lab.tsx`.
3. Tokens and responsive rules in `app/globals.css`.
4. [Design system](docs/DESIGN_SYSTEM.md).
5. Approved visual references, if added under `docs/design-references/`.

When these disagree, investigate the intent and repair the disagreement. Do not introduce a third pattern.

Architecture references:

- [Tool architecture](docs/tool-architecture.md)
- [Processing architecture](docs/processing-architecture.md)
- [Update architecture](docs/update-architecture.md)
- [Release guide](docs/releases.md)

## Commands

Use Node.js 22.13+ and npm. These are the scripts that actually exist in `package.json`:

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run validate:artifact
```

`npm test` already runs a production build before the Node test suite. `npm run build` regenerates `public/sw.js` and `public/release.json`; generated diffs are expected only when version/release inputs change.

Before handing off a normal change, run typecheck, lint, tests, and build. Add or update a focused test for routing, release/update logic, registries, processor contracts, or documentation invariants when the change touches them.

## Repository map

- `app/components/image-lab.tsx`: unified client workspace and the current shared component implementations. Keep primitives reusable; do not clone their markup into feature branches.
- `app/lib/tools.ts`: canonical tool registry, routes, capabilities, categories, modes, and worker intent.
- `app/lib/processor.ts`: Canvas decode/render/operation-stack/encode pipeline. It must not depend on view state.
- `app/lib/settings-registry.ts`: canonical searchable Settings metadata.
- `app/lib/service-worker.ts`, `app/lib/updates.ts`, `app/lib/version.ts`, `app/lib/workspace-update.ts`: application update and workspace-restore boundaries.
- `app/tools/[tool]/page.tsx`: direct tool route adapter. It must render the matching editor state.
- `app/settings/`: addressable Settings views.
- `app/dev/design-system/`: development-only live component showcase; it imports real shared components.
- `app/globals.css`: design tokens, component styles, layout, theme, density, reduced-motion, and responsive rules.
- `public/sw.template.js`: maintained service-worker source. Do not hand-edit generated `public/sw.js`.
- `worker/index.ts`: Cloudflare/Vinext application server entry; it is not the browser image-processing worker.
- `tests/`: Node tests against built routes and pure TypeScript modules.
- `docs/`: focused architecture and design contracts.

Prefer improving this structure over reorganizing it. A larger extraction from `image-lab.tsx` is valid only when it preserves imports, behavior, styling, and history/routing contracts and is covered by checks.

## TypeScript and state

- Keep strict TypeScript types at registry, processor, route, persistence, and component boundaries. Avoid `any`; narrow browser API failures and unknown metadata.
- Keep browser-only code inside client components or guarded by `typeof window !== "undefined"`.
- The workspace currently owns local React state. Preferences/favorites/recents use browser storage; update restoration uses IndexedDB with a non-file session fallback. Do not add a global store for isolated state.
- Derive sidebar, search, command palette, routes, and labels from registries instead of maintaining duplicate arrays.
- Treat imported `File` objects and operation configs as immutable inputs. Clone snapshots before history or persistence writes.
- Cleanup timers, listeners, abort controllers, object URLs, and decoded image resources in the lifecycle that created them.

## Component and design rules

Do not create a UI component before checking whether an existing ImageLab component solves the problem. Search:

1. `app/components/image-lab.tsx` and any future shared component directory.
2. [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).
3. `/dev/design-system` while running `npm run dev`.
4. Existing editor, loading, progress, inline error, menu, and mobile-sheet patterns.

Extend an existing primitive when the interaction is the same. For example, theme, format, export, and processing option pickers use `ImageLabSelect`; do not add separate dropdown implementations. New primitives must represent a genuinely different interaction and must be added to both the design-system document and live showcase.

Visible browser-default controls are forbidden where ImageLab has a custom presentation. Native inputs remain underneath for semantics, keyboard behavior, and assistive technology. Do not expose raw selects, browser-styled ranges, number spinners, default checkboxes/radios, visible file inputs, `alert()`, `confirm()`, `prompt()`, or native context menus for app actions.

Use tokens from `app/globals.css`. Do not scatter page-specific hex colors, shadows, radii, or arbitrary typography/spacing. Verify Light, Dark, and System modes. Avoid decorative status pills; communicate state through the component, inline copy, progress, or error treatment.

## Editor and image processing

A **Tool** is an available capability from `app/lib/tools.ts`. An **Operation** is a configured instance in the non-destructive stack:

```ts
type ImageOperation = {
  instanceId: string;
  toolId: string;
  enabled: boolean;
  settings: Config; // represented by `config` in the current type
  order: number;
};
```

Do not assume a tool appears only once. `renderStack()` sorts enabled operations by `order` and applies each immutable config to the preceding canvas.

The editor preview must remain mounted while editing. A parameter change must not recreate the canvas, reset zoom/pan, flash the checkerboard, reload the original file, or repeatedly decode the source. Render the next capped preview off to the side, then paint it into `PersistentPreview`. Full-resolution rendering is for export.

Undo/redo supports Ctrl/Cmd+Z, Ctrl+Y, and Ctrl/Cmd+Shift+Z. A continuous gesture such as slider dragging creates one history entry when committed, not one entry per input event. Pass transient values through `onChange` and record through `onCommit`.

Do not repeatedly decode source images, block the UI thread with avoidable full-resolution work, or import heavy codecs eagerly. Use abort signals, bounded batch concurrency, dynamic imports, and preview-size caps. Revoke Blob URLs, close `ImageBitmap` objects, and release intermediate resources.

The tool registry's `worker` flag is worker intent, not proof of current browser-worker execution. Current Canvas processing has a main-thread compatibility path. Move expensive work to a browser worker/`OffscreenCanvas` pool only behind the existing processor contract and keep a tested fallback. Never confuse that with `worker/index.ts`, which serves the deployed app.

## Routing and history

URL state and visible workspace state must stay synchronized. `/tools/pixelate` renders the Pixelate editor; Settings section URLs render the named section. A URL change without a matching view change is a bug.

Back, Forward, refresh, direct deep links, and `?workspace=` must preserve the expected view. Use the existing route helpers and `popstate` handling. Add a built-route test when adding an addressable route.

## Loading and errors

- Use a layout-matching skeleton while content is not yet available.
- Use determinate progress when a real measure exists and indeterminate progress otherwise.
- Keep the previous valid preview visible while generating its replacement.
- Put file/tool errors where they occurred, with a useful reason and Retry/Remove when actionable.
- Do not use a global modal or “Something went wrong” for a single failed file.

## Accessibility and mobile

Custom controls must retain semantic roles, labels, keyboard behavior, focus-visible treatment, focus restoration/trapping where applicable, contrast, and reduced-motion behavior. Never remove native accessibility to obtain a custom appearance.

Do not shrink the desktop editor into mobile. Preserve the canvas-first layout, horizontal file strip, touch-sized targets, long-press context actions, draggable context bottom sheet, `100dvh`, and safe-area insets. Check every UI feature at a narrow viewport and ensure the canvas does not cause page scrolling.

## Updates, releases, and repository safety

`package.json` is the only application version source. Stable updates compare public GitHub release metadata and activate an already-prepared service worker only after explicit user action. Never reload an active editor behind the user, bypass the workspace snapshot, or make normal editing depend on GitHub/network availability.

Preserve `.openai/hosting.json`, the package manager, lockfile, deployment scripts, service-worker generation, and GitHub release workflow. Do not commit secrets, `.env*`, API tokens, local browser data, caches, dependencies, build output, generated user images, or user files. Do not rewrite public release tags; ship a new patch. Keep unrelated working-tree changes out of commits.

## UI completion checklist

- [ ] Reuses existing ImageLab components.
- [ ] Works in Light, Dark, and System themes.
- [ ] Works on narrow mobile layouts.
- [ ] Keyboard and screen-reader behavior is intact.
- [ ] No visible native browser controls or unnecessary pills.
- [ ] Loading and inline error/retry states are correct.
- [ ] Canvas/image preview does not flicker or remount.
- [ ] No unnecessary page scrolling.
- [ ] Back/Forward, refresh, and direct routes still work.
