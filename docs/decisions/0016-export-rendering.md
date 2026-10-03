# 0016. Export images from a derived scene, rendered as static SVG

- **Status:** Accepted
- **Date:** 2026-09-28
- **Feature:** `specs/012-export` (spec, research R1–R13, contracts)

## Context

012 adds an Export dialog: JSON of the whole deck, and PNG / SVG pictures of the whole deck, the
current view or the shown flow. Everything must run in the browser with no network request
(principle IV), must not disturb the live canvas, and the picture must look like the canvas.
React Flow renders only what it mounts (off-screen nodes are virtualised), and its node / edge
conversion (`toFlowNodes` / `toFlowEdges`) keeps single-slot caches for array identity.

## Decision

1. **Static SVG from a derived scene (R1).** `editor/export/scene.ts` turns the deck and the scope
   into positioned shapes, reusing the canvas's pure helpers (`viewStateOf`, `visibleGraph`,
   `groupBounds`, `flowOverlay`, `collapseFlowMarks`, `stickyCanvasPosition`) and cache-free
   exports of `deck-to-flow.ts` (`exportPortRects`, `groupCounts`). It never calls
   `toFlowNodes` / `toFlowEdges`, so the canvas caches are untouched. `render-svg.ts` writes one
   standalone SVG; the preview, the SVG file and the PNG are the same drawing.
2. **Light only (R2).** Images always use the light token values (`export-palette.ts`, checked
   against `tokens.css` by a test). A dark option later is one more palette.
3. **Embedded fonts (R4).** `@sododeck/ui/lib/embedded-fonts` inlines the Geist and Geist Mono
   latin / latin-ext woff2 files as data URLs with Vite `?inline` (the font packages resolve only
   from `packages/ui`). Only the lazy export chunk imports it, so the editor bundle does not grow
   and no font is fetched.
4. **PNG from the SVG, on the main thread (R5).** Workers cannot decode SVG images, so the SVG is
   drawn onto a `<canvas>` at 1× / 2× / 3× and encoded with `toBlob`. Scales beyond 16,384 px per
   side or 16,777,216 px in area (Safari's cap) are disabled ("Too large for this browser").
5. **Icons copied from lucide (R7).** `icon-paths.ts` holds the lucide geometry of the icons the
   export draws; a drift test renders the lucide-react components and compares, so an upgrade
   that redraws an icon fails a test instead of diverging.
6. **Main-thread generation with a budget (R8).** `buildScene` + `renderSvg` run on the main
   thread after a 150 ms debounce. Budget: < 50 ms (no long task) for 500 components / 1,000
   connections in the bench browser, with a 250 ms jsdom ceiling in `scene.perf.test.ts`. If the
   bench shows a long task, the two pure modules move to a worker with `OffscreenCanvas`
   measurement; they import no DOM API, so no redesign is needed.
7. **JSON without a model change (R9).** Pretty JSON is `serializeDeck` unchanged
   (byte-identical to the backup export). Compact is `JSON.stringify(JSON.parse(…))`, which keeps
   the canonical key order. "Include descriptions, links and rules" off is a pure
   `withoutKnowledge(file)` before serialising.

## Alternatives considered

- **Capture the React Flow DOM** (`html-to-image`-style `<foreignObject>`): a new dependency,
  only mounted nodes (breaks "whole extent"), carries hover / selection state, and
  `<foreignObject>` is not editable in vector tools.
- **Render React components to a string** (`react-dom/server`): pulls the server renderer into the
  bundle and still emits HTML inside SVG.
- **Text as paths:** not editable, and needs a font parser dependency.
- **Link fonts by URL:** breaks outside the app and is a network reference.
- **A worker from the start:** a protocol and a deck copy for work measured well under the
  budget, and PNG still needs the main thread.

## Consequences

- Card, edge and sticky geometry in `export/render-svg.ts` / `export/edge-geometry.ts` must follow
  canvas changes (017 routes and sizes, 020 card styles are marked `TODO(017)` / `TODO(020)`).
- Known differences from the canvas: no dotted background, stickies in their one-line form, edge
  labels always drawn, merged edges show "×n" without the direction icon, port pills show
  the outside component's title without "Go to".
- 029 (Deck look): the export draws the Deck card (lip, type tile, wrapped title, tags as pills,
  count discs), the three line types through the shared `routedPath`, the knob and arrow marks from
  `edge-end-marks.ts` (as `transform`ed paths: the export is static) and fanned collapsed groups.
  The pure modules shared with the canvas are `card-layout.ts`, `edge-end-marks.ts` and the tag chip
  placement. `buildScene` + `renderSvg` on the 500 / 1,000 bench deck takes about 17 ms (jsdom),
  under the 50 ms budget, so decision 6 (main thread) still holds (`specs/029-card-look-deck/bench-after.md`).
- PDF and Mermaid can be added to the data-driven format list later.
- 0015 is reserved for the 019 plan.
