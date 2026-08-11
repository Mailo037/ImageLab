# Processing architecture

ImageLab keeps the normal processing path in browser memory:

```text
File / clipboard / drag-drop
  → File object + object URL
  → createImageBitmap decode
  → Canvas render pipeline
  → Blob encode
  → browser download or local JSZip archive
```

`app/lib/processor.ts` contains reusable operations instead of component-bound processing. `renderStack()` applies an ordered non-destructive operation list to a Canvas and accepts an `AbortSignal`, a preview resolution cap, and stage callbacks. `encode()` produces native Canvas formats, target-size encodes lossy formats, and creates BMP/ICO blobs without a server.

The original imported `File` is never rewritten by editing. Each active edit is stored as an operation instance with an id, tool id, enabled state, settings, and order. The final raster is encoded only for export, download, copy, or explicit flattening.

## Interactive previews

The workspace renders capped-resolution previews while settings are being changed. A persistent `<canvas>` stays mounted and receives the most recent valid preview only after the next frame has rendered, so a slider does not blank the image or reset zoom/pan. Exports render at full selected resolution. This avoids repeated full-resolution work while a slider is moving.

## Batch work

The export loop marks the affected queue row as processing, reports real stage and per-file progress, respects cancellation, and leaves successful files completed when a later item fails. ZIP support is dynamically imported and reports JSZip's actual archive progress.

## Resource ownership

- Imported `File` objects remain in browser memory for the active session.
- Object URLs are revoked when imported files are replaced or removed.
- `ImageBitmap` objects are closed immediately after their pixels are drawn.
- Abort signals stop expensive loops between safe units of work.
- Imported image bytes are not persisted by default; local Recent records contain metadata only.

## Workers and future expansion

The registry already expresses whether a tool is a candidate for worker execution. Canvas APIs are used directly for the current compact build so supported browsers have a reliable baseline. A worker pool can adopt the same processor input/output contract without changing the sidebar, queue, export, or tool registry contracts. Prefer `OffscreenCanvas` in that pool where browser support is available, and fall back to the current main-thread preview path only for small or compatibility-sensitive work.
