# Implementation Plan: Connection Focus and Drill-in

**Branch**: `034-connection-focus-and-drill` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/034-connection-focus-and-drill/spec.md`, clarified on 2026-10-03: only automatic-route connectors bundle; the highlight is Ink 2.75px with colour and weight as separate rules (022 decides on styled connectors); a shown flow takes its connectors out of bundles; hover focus starts after a ~150 ms rest and clears after a ~100 ms grace.

**Dependency**: 029 (`2e85e4a`) is merged on `main`. I checked these names in the code:

- **Focus**: `editor/focus-set.ts` (`focusSet(deck, graph, id)` → `{ focusId, members, edges }`); `canvas.tsx` (`focusMode`, `focusId`, `data-focus-mode` on the wrapper, `pointerFocus` ref, roving `focusedId`); `deck-to-flow.ts` (`view.focus`, `in-focus` class, `dimmed` + `domAttributes` `aria-hidden` / `inert` on every non-member); `index.css` `[data-focus-mode]` rules (`--sd-deck-dim`); `state/ui-store.ts` (`focusMode`, `setFocusMode`, `focusedId`, `focusedEdgeId`, `hoverEdgeId`).
- **Merged connectors**: `visible-graph.ts` (`MergedEdge { id, a, b, edgeIds, direction }`, `MERGED_EDGE_PREFIX`, built only when one end is a collapsed group); `merged-edge.tsx` (curved `routedPath`, `EdgeEnds`, label button opening `openMergedPopover`); `merged-edge-popover.tsx`; `deck-to-flow.ts` `mergedCache`.
- **Drill-in**: `visible-graph.ts` (`PortPill { id, outsideNodeId, outsideTitle, edgeIds, insideNodeIds }`, `PORT_NODE_PREFIX`, `scopeBounds`); `deck-to-flow.ts` (`exportPortRects` = 120 × 36 to the right of the inside anchors, `portNodes`, `portEdges`); `port-pill-node.tsx` ("Go to <title>" button: `drillUp` + select + focus representative); `drill-crumbs.tsx`; `use-canvas-handlers.ts` `isPortNode`.
- **Connectors**: `deck-edge.tsx` (inline `stroke` / `strokeWidth`, `data-in-focus` on the label), `routing/route-path.ts` (`routedPath(shape, from, to, sides, offset, arrows)`), `edge-ends.tsx`, `flows/flow-overlay.ts` (`overlay.edges`, `inPath`), React Flow 12.12 edge wrapper `data-id`.
- **Bench**: `bench/perf.bench.ts` (`focus` scenario through `window.__sododeckBench.focus`), latest report `bench/results/report-2026-10-03T02-31-15-462Z.md`.
- **Export**: `export/scene.ts` uses `visibleGraph`, `exportPortRects`; `export/render-svg.ts`, `export/edge-geometry.ts`.

## Summary

Hovering a card lights up its connections; parallel connectors fold into one "×n" curve; drill-in gets an "Inside <name>" label and dashed Outside proxies.

- **Hover focus** (R1–R3): a `hoverFocus` entry in the UI store, driven by a small hook with the 150 ms rest / 100 ms grace timers. A separate `<HoverFocusStyle>` component turns the focus set into one generated `<style>` with `[data-id]` selectors, so a hover changes **no** React Flow object: the 1,500-object rebuild that pinned focus does today would miss the one-frame target. Pinned focus (F) keeps its current mechanism and takes the same look.
- **Highlighted look** (R2): connectors read `stroke: var(--sd-edge-hl-stroke, <base>)` and `stroke-width: var(--sd-edge-hl-width, <base>)` inline; focus rules set the two variables separately (Ink, 2.75px). Neighbour cards get the Secondary border and lip. Dim: cards `--sd-deck-dim` (22 %), connectors `--color-deck-dim-edge` (20 %).
- **Bundles** (R4–R6): a pure, cached `bundleEdges(deck, graph, options)` groups plain automatic-route edges (and port edges) by unordered pair; excluded: self-loops, `edge.route !== undefined`, the shown flow's edges, everything while recording. Bundles render with the existing `MergedEdge` component (`data.kind: 'bundle'`); fanned-out connectors get a UI-only spread offset in `routedPath`. Fan state is `fannedBundles` in the UI store.
- **Drill-in** (R7–R8): `OutsideProxyNode` replaces `PortPillNode` (150 wide, dashed, type icon, title, "Outside"); a pure `proxyLayout` stacks proxies in a left column (connections only coming in) and a right column (the rest) outside `scopeBounds`. A `ScopeLabelNode` draws "Inside <name> · n" on the scope's top edge. Proxies are focusable, not selectable or draggable; ⏎ / double-click reuses the port pill's "go to" logic.
- **Export** (R9): folded bundles and proxies appear in PNG / SVG through the same pure helpers; hover never does.
- **Bench** (R10): new "hover → focus painted" action scenario; before / after on pan, drag and focus.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed; **no new dependency**. `@xyflow/react` 12.12, `zustand` 5, `lucide-react` (type icons via `KIND_STYLE` / `KIND_FALLBACK`, as in `deck-node.tsx`).

**Storage**: none. Focus sets, bundles, fan state and proxies are derived from the Yjs deck plus UI-only state; nothing is added to the deck, the schema or `packages/model`.

**Testing**: Vitest + Testing Library: pure `bundleEdges`, `focusSet`, `proxyLayout`, hover timers (fake timers), `HoverFocusStyle` output, `deck-to-flow` cache cases, components by role and name, CSS-source checks (like `flow-mode-css.test.ts`). No new e2e (constitution VI, `TODO(e2e)`); the smoke suite must stay green.

**Target Platform**: Evergreen desktop browsers (Chromium for bench and e2e). Touch: no hover focus.

**Project Type**: pnpm / turbo monorepo; changes are in `apps/app` (and docs).

**Performance Goals**: hover → focus painted < 16 ms after the rest delay at 500 / 1,000 (SC-001); pan, zoom, drag within run-to-run variation of the "before" report (SC-005); `bundleEdges` at 500 / 1,000 < 2 ms.

**Constraints**: hover changes no RF object and no document state (FR-004); no colour-only state (VII); reduced motion = no transition (VII); bundles and proxies never stored (FR-015); 017 routes untouched.

**Scale/Scope**: ~5 new modules, ~14 edited files, docs. Estimate 4 d (backlog).

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes; no violations._

| Principle                                    | Status | How                                                                                                                                                                       |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | ✅     | Focus sets, bundles and proxies are derived from the deck at render time; the UI store holds only ids (`hoverFocus`, `fannedBundles`), never document data.               |
| II. Schema-owned format, lossless round-trip | ✅     | No schema, model or file change; SC-007 asserts a deck's data and export are unchanged.                                                                                   |
| III. Stable identity                         | ✅     | Bundle ids come from the sorted pair of visible ids (`bundle:a\|b`), proxy ids from the outside node id; no titles.                                                       |
| IV. Local-first, private                     | ✅     | No network, no new assets.                                                                                                                                                |
| V. Performance off the main thread           | ✅     | Pure O(edges) derivation, cached per snapshot; hover is CSS-only (R1). Bench before / after is a gate (R10).                                                              |
| VI. Strict types and tested behaviour        | ✅     | Unit tests for every pure function and the store; component tests by role; no new e2e.                                                                                    |
| VII. Accessible by default                   | ✅     | Keyboard focus shows the highlight; bundle pill and proxy are buttons with names; Esc folds; weight / dash / count carry state, not hue; reduced motion removes the fade. |
| VIII. Simplicity, justified dependencies     | ✅     | No dependency; reuses `MergedEdge`, the merged popover, `routedPath`, port "go to" logic.                                                                                 |

## Project Structure

### Documentation (this feature)

```text
specs/034-connection-focus-and-drill/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R10
├── data-model.md        # Phase 1: derived entities and UI state
├── quickstart.md        # Phase 1: manual validation walk
├── contracts/
│   └── connection-focus-ui.md   # module APIs, DOM / CSS contract, keys
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/app/src/
├── state/ui-store.ts                     # + hoverFocus, fannedBundles and their actions; cleared on view / drill switch
├── index.css                             # focus look: CSS variables, neighbour lip, dim tokens, reduced motion
└── editor/
    ├── focus-set.ts                      # + bundles as members' connections
    ├── bundles.ts                        # NEW bundleEdges(), BUNDLE_EDGE_PREFIX
    ├── hover-focus/
    │   ├── use-hover-focus.ts            # NEW rest / grace timers, suspension rules
    │   └── hover-focus-style.tsx         # NEW generated <style> from the focus set
    ├── proxy-layout.ts                   # NEW proxyLayout(): proxy rects in two columns
    ├── outside-proxy-node.tsx            # NEW replaces port-pill-node.tsx
    ├── scope-label-node.tsx              # NEW "Inside <name> · n"
    ├── deck-to-flow.ts                   # bundles, proxies, scope label; cache checks
    ├── merged-edge.tsx                   # kind 'bundle', Ink "×n" pill, fan toggle
    ├── merged-edge-popover.tsx           # lists a bundle's connectors (select / delete)
    ├── deck-edge.tsx                     # stroke / width via CSS variables; fan offset
    ├── routing/route-path.ts             # + fan spread for curved / elbow / straight
    ├── canvas.tsx                        # wire hover hook + style, node types, data-hover-focus
    ├── use-canvas-handlers.ts            # proxy / scope-label prefixes; pane click folds
    ├── use-canvas-shortcuts.ts           # Esc folds, ⏎ on bundle / proxy
    └── export/scene.ts, render-svg.ts    # folded bundles and proxies in images
apps/app/bench/perf.bench.ts              # + "hover → focus painted"
apps/app/src/routes/bench-page.tsx        # bench hook for hover
```

**Structure Decision**: Everything lives in `apps/app`, inside the editor's existing modules; `packages/ui` gains no component (the proxy and pill are canvas-only). `port-pill-node.tsx` and its test are removed once the proxy covers its behaviour (FR-012).

## Docs to update

- ADR `docs/decisions/0023-derived-connector-bundles.md` (constitution VIII): bundles and proxies are derived and never stored; only automatic-route connectors bundle, which 022 inherits; hover focus is CSS-only.
- `apps/app/CLAUDE.md`: hover focus mechanism, bundle ids, proxy prefix.
- `.claude/skills/react-flow/SKILL.md` map: `bundles.ts`, `hover-focus/`, proxies.
- `docs/backlog.md`: 034 status; 022 note: "connectors with their own waypoints or style never bundle; 022 decides whether a styled connector keeps its colour when highlighted".
- `DESIGN.md`: nothing new unless the visual check finds a gap.

## Complexity Tracking

No violations.
