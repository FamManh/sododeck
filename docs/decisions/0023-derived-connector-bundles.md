# 0023. Derived connector bundles, Outside proxies and CSS-only hover focus

- **Status:** Accepted
- **Date:** 2026-10-03
- **Feature:** `specs/034-connection-focus-and-drill` (research R1, R4–R8)
- **Builds on:** 0006 (React Flow is a view), 0017 (group frames), 0019 (connector route)

## Context

034 adds three things to the canvas: connections light up when a card is hovered, parallel
connectors between the same two cards fold into one "×n" curve, and a drill-in shows dashed
proxies for the cards outside it. Each could be stored (a bundle object, a proxy position) or
pushed through React Flow state. At 500 cards / 1,000 connectors a hover that rebuilt every React
Flow object would miss one frame (16 ms).

## Decision

1. **Nothing here is stored.** Bundles, proxies, the scope label and the focus set are derived at
   render time from the deck and UI-only state (`hoverFocus`, `fannedBundles`). No schema, model
   or file change; a hover, a fan-out or a drill never reaches the undo history or an export.
2. **Only automatic connectors bundle.** A connector with its own `route` (017) or its own
   `style` (a line type today; waypoints, anchors and a style with 022) always draws on its own
   and never joins a bundle. A shown flow takes its connectors out of bundles; recording a flow
   turns bundling off, so every connector stays clickable as a step. `bundleEdges` in
   `editor/bundles.ts` is the one place that decides, and 022 extends its `foldable` check.
3. **Fan-out is a render-only offset.** A fanned bundle draws its connectors with a 14 px spread
   in `routedPath`; it is never written to `edge.route`.
4. **Hover focus is CSS only.** `HoverFocusStyle` turns the focus set into one generated
   `<style>` (`[data-id]` selectors); no React Flow object changes and nothing becomes `inert`
   or `aria-hidden`. Pinned focus (F) keeps its mechanism and takes the same look.
5. **Highlight colour and weight are separate rules** (`--sd-edge-hl-stroke`,
   `--sd-edge-hl-width`), read through CSS variables with the base value as fallback, so 022 can
   drop the colour for a styled connector and keep the weight.
6. **Outside proxies** replace the port pills: `proxyLayout` places them in a left column (inputs)
   and a right column (everything else), shared by the canvas and the export.

## Consequences

- Export and canvas agree: folded bundles and proxies appear in images, hover never does.
- A connector edited into a custom route or style leaves its bundle, and the count drops.
- The `port:` prefix and the `bundle:` and `scope-label:` prefixes are reserved ids.
