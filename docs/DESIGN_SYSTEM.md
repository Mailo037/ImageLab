# ImageLab design system

This is the canonical UI reference for ImageLab. It documents the current implementation rather than a hypothetical component library. The live development showcase is available at `/dev/design-system` under `npm run dev`; the route intentionally returns 404 in production and is not linked from application navigation.

## Source of truth and component creation

Use this order when implementation and references differ:

1. Working implementation and tests.
2. Shared components in [`app/components/image-lab.tsx`](../app/components/image-lab.tsx).
3. Tokens and responsive styles in [`app/globals.css`](../app/globals.css).
4. This document.
5. Approved visual references under `docs/design-references/`, if that directory is added.

Before creating a shared component:

1. Search the shared component source.
2. Check this catalog.
3. Inspect `/dev/design-system`.
4. Extend an existing component if its interaction is the same.
5. Create a primitive only for a genuinely different interaction.
6. Add it here and to the live showcase in the same change.

Do not add `ThemeDropdown`, `FormatDropdown`, `ExportDropdown`, or `ToolDropdown` as separate implementations. Those choices share `ImageLabSelect`.

## Visual foundation

### Tokens

Tokens live in [`app/globals.css`](../app/globals.css). Components use relationships between surfaces rather than independent hex values.

| Token | Role |
| --- | --- |
| `--bg` | App background and lowest surface |
| `--surface` | Primary panels and workspace chrome |
| `--soft` | Recessed controls and subtle rows |
| `--raised` | Menus, dialogs, active controls |
| `--text` | Primary foreground |
| `--muted` | Supporting copy and labels |
| `--faint` | Metadata and low-priority icons |
| `--line`, `--line2` | Default and stronger boundaries |
| `--accent`, `--accent2` | Primary action and emphasized interactive foreground |
| `--accent-soft` | Selected/hovered low-emphasis surface |
| `--danger`, `--danger-soft` | Destructive action and inline failure surface |
| `--shadow` | Elevated overlay shadow |
| `--checker-a`, `--checker-b` | Transparent-canvas checkerboard |
| `--font` | Primary Geist-based UI stack |

The global focus ring uses `--accent`. Add a token when a value is repeated across features; do not hardcode a new color in a page because it is convenient. `color-mix()` is preferred for derived hover/overlay values.

### Themes

Light tokens are declared on `:root`; dark tokens override them on `:root[data-theme="dark"]`. System mode resolves to one of these themes in the workspace. Every component change must be checked in Light, Dark, and System.

Think in surface levels:

```text
App background (`--bg`)
  → primary panel (`--surface`)
    → recessed control (`--soft`)
      → popover/menu/dialog (`--raised`)
```

This hierarchy applies to the editor, Settings, command palette, tool sidebar, export panel, context menus, and mobile sheet. Do not assign each feature an unrelated background.

### Typography

Geist is the primary UI font, loaded in [`app/layout.tsx`](../app/layout.tsx); Geist Mono is available through `--font-geist-mono` for machine-readable data only. Existing typography is deliberately compact:

- page display headings: responsive 28–54px, tight negative tracking;
- workspace/page headings: 16–27px;
- panel headings: 12–15px;
- body and control text: 10–13px;
- metadata/eyebrows: 8.5–10px, with uppercase reserved for category labels;
- numeric values: tabular numerals where values update or align.

Reuse the surrounding class and scale. Do not add arbitrary font sizes or use monospace decoratively.

### Spacing, targets, and radius

- workspace desktop padding: 18–20px; compact panel padding: 14–18px;
- form control gaps: 5–9px; related control groups: 10–15px;
- toolbar/action gaps: 3–8px; independent sections: 22–52px;
- desktop compact controls are 31–34px tall; mobile primary targets must remain touch-friendly through row/sheet layout and spacing;
- `100dvh` and safe-area insets are required for full-height mobile surfaces.

Radius hierarchy:

- 4–8px: compact inputs, buttons, row actions, menu items;
- 9–13px: dropdowns, panels, dialogs, popovers;
- 14–18px: workspace canvas, import surface, and mobile sheet.

Do not make every element rounded. Rows may use separators or subtle hover backgrounds without a containing card.

## Component catalog

All catalog components below are real exports from [`app/components/image-lab.tsx`](../app/components/image-lab.tsx). “Preview” names the matching section in `/dev/design-system`.

### `Button`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Actions → Buttons  
Use for primary and secondary text actions. Add `className="primary"` for the single emphasized action in a local group. Supports default, hover, active, focus-visible, disabled, and loading content.

```tsx
<Button className="primary" onClick={exportImage}>Export image</Button>
```

### `IconButton`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Actions → Icon actions  
Use for compact toolbar actions. `label` is mandatory and becomes the accessible name. Pair unfamiliar icons with `ImageLabTooltip`.

### `ImageLabTooltip`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Actions → Icon actions  
Use for short supporting labels on hover/focus. It is not a replacement for a visible form label or error.

### `ImageLabSelect`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Inputs → Select and number  
Use for theme, format, density, quality preset, and other single-choice options. It implements listbox semantics, keyboard traversal, selection, focus restoration, viewport-aware placement, and disabled state.

```tsx
<ImageLabSelect
  label="Output format"
  value={format}
  options={formatOptions}
  onChange={setFormat}
/>
```

### `ImageLabNumberInput`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Inputs → Select and number  
Use for bounded numeric values such as width, height, quality, or target size. It hides native spinner UI, supports keyboard nudging, optional unit/reset, draft text, validation, and commit boundaries.

### `ImageLabSlider`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Inputs → Continuous controls  
Use for quality, threshold, blur, brightness, contrast, and other continuous values. `onChange` updates the transient preview; `onCommit` creates one history action after pointer/keyboard interaction.

```tsx
<ImageLabSlider
  label="Threshold"
  value={threshold}
  min={0}
  max={255}
  onChange={setThreshold}
  onCommit={commitEdit}
/>
```

States: default, hover, dragging, keyboard focus, resettable, and disabled-by-parent. Do not record a history entry for every drag event.

### `ImageLabColorField`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Inputs → Continuous controls  
Use for editable colors. The semantic color input is visually hidden behind the ImageLab swatch and paired hex field.

### `ImageLabSwitch`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Inputs → Boolean controls  
Use for persistent on/off settings with an optional explanation. Native checkbox semantics remain underneath the custom track.

### `ImageLabCheckbox`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Inputs → Boolean controls and Rows → File rows  
Use for item selection. It supports unchecked, checked, keyboard focus, and disabled-by-parent states.

### `ImageLabDisclosure`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Inputs → Disclosure  
Use for optional advanced settings, not required decisions.

### `ImageLabProgress`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Feedback → Determinate progress  
Use only when progress is measurable. It exposes `progressbar`, value bounds, current value, and an accessible label.

### `PalettePanel`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Feedback → Layout skeleton  
Its working state is the current reusable reference for layout-matching skeleton rows. Create a dedicated skeleton primitive only when at least two independent layouts need the same API.

### `EditorEmpty`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Feedback → Empty workspace  
Use for an editor route with no imported image. It keeps the selected tool visible and presents Browse/Paste actions.

### `Queue`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Rows → File rows  
The file-row reference for normal, selected, active, reading, processing, failed/retry, and completed/output states. On mobile it becomes a horizontal filmstrip; do not create a separate mobile file list.

### `List`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Rows → Tool rows  
The compact registry-backed quick-tool list. The full sidebar uses the same `Tool` registry and related row language.

### `ImageLabContextMenu`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Overlays → Context menu  
Use for secondary file, tool, operation, and canvas actions. It supports keyboard navigation, Escape, disabled items, separators, and destructive tone. Desktop uses right-click/overflow; touch uses long-press or an explicit overflow trigger.

### `ImageLabDialog`

Source: [`app/components/image-lab.tsx`](../app/components/image-lab.tsx)  
Preview: Overlays → Dialog  
Use for focused input or necessary confirmation. It traps focus, closes with Escape/backdrop, and restores the custom ImageLab surface. Do not use native `alert()`, `confirm()`, or `prompt()`.

### Composite editor patterns

`PersistentPreview`, `AppliedEdits`, command palette, Settings search, tool panels, export feedback, and the responsive `.context` bottom sheet currently live in [`app/components/image-lab.tsx`](../app/components/image-lab.tsx). They are intentional composites rather than generic primitives.

- Preview `PersistentPreview` in any tool route with an imported image.
- Preview `AppliedEdits` by applying multiple operations, including a duplicate tool.
- Preview the draggable bottom sheet by narrowing an editor route below 720px.
- Preview Settings search at `/settings` and command palette with Ctrl/Cmd+K.

Do not copy these composites into another feature. Extract only when a second real consumer requires the same contract.

## Control-state rules

| Component | Required states |
| --- | --- |
| Button / icon button | default, hover, active, focus-visible, disabled, loading |
| Text / number input | default, focused, invalid, disabled |
| Select / menu | closed, open, active option, selected option, keyboard focus, disabled |
| Slider | default, hover, dragging, keyboard focus, resettable, disabled |
| Checkbox / switch | off, on, focus-visible, disabled |
| File row | normal, selected, active, reading, processing, failed, completed |
| Operation row | normal, selected, disabled, dragging, mobile actions |

State belongs in the component through control styling, copy, progress, or inline errors. Do not manufacture decorative status pills for these states.

## Browser controls and accessibility

Visible browser-default controls are not allowed when ImageLab has a component. Do not expose raw `<select>`, browser-styled range tracks, number spinners, default checkbox/radio visuals, visible file inputs, native action context menus, or browser alert/confirm/prompt dialogs.

Native elements may remain internally for semantics. Preserve:

- keyboard interaction and expected roles;
- accessible names and screen-reader state;
- focus-visible treatment and focus restoration/trapping;
- sufficient contrast in both themes;
- reduced-motion support from the OS and ImageLab setting.

## Interaction patterns

- Choice dropdown: `ImageLabSelect`.
- Secondary actions: `ImageLabContextMenu` or an overflow trigger, not a permanent button wall.
- Destructive action: direct action when reversible; `ImageLabDialog` when confirmation prevents meaningful loss.
- Mobile secondary actions: long-press/touch-friendly menu.
- Settings lookup: the registry-backed Settings search, not a parallel search list.
- Tool navigation: registry route, not manual view-only state.

### Loading

- Skeleton: interface content does not exist yet; match the eventual layout.
- Determinate progress: actual measurable progress is known.
- Indeterminate progress: work is active but cannot be measured.
- Preview processing: keep the previous valid preview mounted until the next frame is ready.

Never blank/remount the editor canvas during normal processing. Do not reset zoom or pan, flash the checkerboard, reload the source, or decode it again without necessity.

### Errors

Put errors where they occur:

```text
image.webp
Could not decode image.  Retry  Remove
```

Use a specific, actionable reason. A single file failure stays in its row or canvas area; it does not open a global modal. Avoid generic “Something went wrong” when the operation can identify decode, encode, clipboard, format, network, or storage failure.

## Responsive behavior

Mobile is canvas-first, not a scaled desktop dashboard. The editor uses a horizontal file strip, touch-friendly actions, long-press menus, and a draggable collapsed/medium/expanded context sheet. Use `100dvh`, safe-area insets, and contained scrolling. The canvas, file strip, and sheet own their space; the document should not gain accidental scrolling.

## UI implementation checklist

- [ ] Reuses an existing ImageLab component.
- [ ] Works in Light, Dark, and System.
- [ ] Works on narrow mobile layouts.
- [ ] Keyboard and screen-reader behavior is intact.
- [ ] No visible native browser controls or unnecessary pills.
- [ ] Loading and inline error/retry behavior is correct.
- [ ] Canvas/image preview does not flicker or remount.
- [ ] No unnecessary page scrolling.
- [ ] Existing routing, Back/Forward, refresh, and deep links still work.
