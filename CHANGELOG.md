# Changelog

All notable changes to ImageLab are documented here.

## 1.0.0 — 2026-08-11

### What's new

- Added a local-first ImageLab workspace with a non-destructive edit stack, batch processing, local export, tool routes, and responsive mobile editing surfaces.
- Added addressable Settings sections, fuzzy Settings search, and command-palette access to Settings controls.
- Added version metadata, stable release awareness, service-worker update coordination, and local workspace preservation for explicit PWA updates.

### Fixes

- Kept editor previews mounted during live adjustments to avoid canvas flicker and unwanted zoom resets.
- Improved mobile routing, tool discovery, command-palette scrolling, and independent workspace panels.

### Performance

- Added capped interactive preview rendering and local resource cleanup for images and object URLs.
