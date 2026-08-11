# Tool architecture

`app/lib/tools.ts` is the source of truth for ImageLab tools. Views do not maintain their own disconnected list of tool names or routes.

Each `Tool` entry carries:

- stable `id`, `name`, `description`, `category`, `icon`, and shareable `route`;
- supported input and output formats;
- a UI `mode` and optional processing `effect`;
- declared settings, batch/preview capability, execution kind, worker intent, and optional shortcut.

The workspace derives the sidebar, home quick links, favorite list, command palette, fuzzy search, category browsing, and `/tools/[tool]` route selection from that registry.

## Extension contract

Use an existing `mode` when a new tool has the same interaction pattern. For example, a new Canvas effect generally uses `mode: "effect"` with a new `effect` value. A new mode should supply a focused settings section in `ToolPanel` and be documented here.

`forTool` is the configuration reset boundary. It translates a tool selection into reusable configuration, rather than placing special processing logic in each preset button. Platform presets only set reusable dimensions and aspect configuration.

## Current modes

| Mode | Purpose |
| --- | --- |
| `compress` | output format, quality, and target size |
| `resize`, `crop`, `rotate`, `padding` | geometric transformations |
| `effect`, `color` | Canvas raster effects and channel adjustments |
| `transparent`, `privacy` | alpha-keying, edge removal, and interactive masks |
| `text`, `shape` | creative overlays and treatments |
| `palette`, `metadata` | local inspection pipelines |
| `grid`, `favicon` | composition and icon export |

When a processor cannot run entirely in the browser, it should be marked unavailable with a concise explanation rather than silently uploading user images.
