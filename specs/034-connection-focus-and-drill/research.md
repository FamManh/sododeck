# Research: Connection Focus and Drill-in (034)

Decisions for the plan. Each has the decision, the rationale and the alternatives considered. No `NEEDS CLARIFICATION` remains.

## R1. Hover focus is CSS-only, driven by one generated `<style>`

**Decision**: The UI store holds `hoverFocus: { id, source: 'pointer' | 'keyboard' } | null`. `Canvas` does **not** subscribe to it. A small `<HoverFocusStyle>` component (rendered inside the canvas wrapper) subscribes, computes `focusSet(deck, graph, id, bundles)` and renders one `<style>` element:

```css
[data-hover-focus] .react-flow__node:not(:is([data-id="a"], [data-id="b"])) { opacity: var(--sd-deck-dim); }
[data-hover-focus] .react-flow__edge:not(:is([data-id="e1"], [data-id="bundle:a|b"])) { opacity: var(--color-deck-dim-edge); }
[data-hover-focus] .react-flow__edge:is([data-id="e1"], …) { --sd-edge-hl-stroke: var(--color-ink); --sd-edge-hl-width: 2.75px; }
[data-hover-focus] :is([data-edge-label-for="e1"], …) { … }   /* labels live in the HTML layer */
```

Ids are escaped with `CSS.escape`. `data-hover-focus` is set on the wrapper by the same component through a ref (no `Canvas` render). React Flow 12.12 already writes `data-id` on node and edge wrappers; edge labels and merged pills get a static `data-edge-label-for` attribute.

**Rationale**: Pinned focus today rebuilds every RF object (`dimmed`, `domAttributes`) because it also makes non-members `inert`. That costs tens of ms at 500 / 1,000 and would miss SC-001 (one frame) on every hover. A generated stylesheet touches no React Flow object and no card component: one style recalculation. Hover must also not make other cards `inert` or `aria-hidden`: the pointer has to reach the next card, and screen-reader users must not lose cards because the pointer rests somewhere.

**Alternatives**: (a) reuse `view.focus` in `deck-to-flow` (too slow, and `inert` breaks moving to the next card); (b) toggle a class on member DOM elements imperatively (fights React Flow's re-render of `className`); (c) `:has()` selectors from the hovered card (cannot express "neighbour of").

## R2. One highlighted look, with colour and weight as separate CSS variables

**Decision**: `DeckEdge` and `MergedEdge` write `stroke: var(--sd-edge-hl-stroke, <base stroke>)` and `strokeWidth: var(--sd-edge-hl-width, <base width>)` inline, and pass the same colour variable to `EdgeEnds`. The focus rules (hover style and `[data-focus-mode] .react-flow__edge.in-focus`) set the two variables in **separate declarations**, so 022 can drop the colour rule for a styled connector and keep the weight (FR-002, clarification 2). A selected or flow-marked connector keeps its own stroke (its inline value is not wrapped in the variable). Neighbour cards: `.sd-card` border and lip switch to Secondary (`DESIGN.md` "Highlighted neighbour"). Dim levels are the 029 tokens: cards `--sd-deck-dim` (0.22), connectors and their labels `--color-deck-dim-edge` (0.20). Pinned focus moves its connectors from `--sd-deck-dim` to the edge token so both modes match. Transitions use `--sd-dur-dim` (0 under reduced motion).

**Rationale**: Inline styles beat CSS; a variable with a fallback lets CSS override without `!important` and keeps the base look exactly as today when no focus is shown (FR-008, Story 2.7).

**Alternatives**: `!important` CSS on `.react-flow__edge-path` (also hits selected and flow strokes, harder for 022); passing `highlighted` through `data` (rebuilds edges, R1).

## R3. Hover timing and suspension live in one hook

**Decision**: `useHoverFocus()` (in `hover-focus/use-hover-focus.ts`) handles `onNodeMouseEnter` / `onNodeMouseLeave` from React Flow plus keyboard focus:

- Enter a card or collapsed group (deck, `collapsed:` and `group:` ids; not stickies, proxies or the scope label): start a **150 ms** rest timer; on fire, set `hoverFocus`. If a hover focus is already showing (or in its grace period), switch at once (Story 1.3).
- Leave: start a **100 ms** grace timer; entering another card cancels it.
- Keyboard: when roving focus lands on a card through the keyboard (the canvas's existing `pointerFocus` ref is false), set `hoverFocus` at once with `source: 'keyboard'`; it clears when focus leaves the card or the canvas.
- Pointer type `touch` is ignored (edge case "touch").
- Suspended (no timer started, any shown hover cleared) while: pinned focus (`focusMode`), a flow is shown or recorded (`activeFlow` / `flowSession`), a drag (`data-dragging`), a resize or reconnect gesture, a connection being drawn (RF `connection.inProgress`), the hand tool, or a menu / popover is open.

**Rationale**: Clarification 4. One hook keeps the timers testable with fake timers and away from the 1,000 edge components.

**Alternatives**: CSS `:hover` with `transition-delay` (cannot express neighbours); `requestIdleCallback` (non-deterministic).

## R4. Bundles are a separate pure pass after `visibleGraph`

**Decision**: `bundleEdges(deck, graph, { exclude, fanned, off })` in `editor/bundles.ts` returns `{ plain: string[]; bundles: Bundle[]; portPlain: …; portBundles: … }`:

- Candidates: `graph.edges` and port edges (inside representative ↔ `port:` id). Ends are resolved through `graph.representative`.
- Excluded from bundling (drawn as today): self-loops; `edge.route !== undefined` (clarification 1); ids in `exclude` (R5); everything when `off` (R5).
- Key = unordered pair of visible ids. A pair with ≥ 2 candidates becomes `Bundle { id: 'bundle:' + a + '|' + b, a, b, edgeIds, direction }` (direction rule shared with `mergeDirection`); a pair with 1 stays plain (FR-008).
- A bundle whose id is in `fanned` returns its edges as plain with a `fanIndex` / `fanCount` each (R6) and is listed as `fannedBundles` so its pill still draws.
- Cached in a `WeakMap` keyed by the `graph` object plus a string key of `exclude` / `fanned` / `off`.

Collapsed-group merged connectors (`graph.merged`) are untouched: they already bundle every connector to a collapsed group, and their popover stays (edge case).

**Rationale**: `visibleGraph` is cached per deck / scope / collapse and used by export and the outline; bundling also depends on UI state (fan, flow), so it must not live inside it.

**Alternatives**: bundling inside `visibleGraph` (cache explosion, leaks UI state into export); drawing parallel edges with an automatic offset and no bundle (does not meet the "×n" design).

## R5. A shown flow and recording turn bundling off where it matters

**Decision**: While a flow is **shown or playing** (`activeFlow !== null`), `exclude` = the edges in that flow's overlay (`overlay.edges` keys with a mark): they draw on their own with 035's look; the remaining connectors of the pair re-bundle with the lower count (FR-005a). While a flow is **recorded** (`flowSession !== null`), `off = true`: every connector must be clickable as a candidate step (006). Closing the flow or the session re-forms bundles.

**Rationale**: Clarification 3. Recording was not asked about, but a bundled candidate cannot be clicked on its own, which would break 006; turning bundles off is the smallest safe rule. Reported in the final report as a plan-level default.

**Alternatives**: auto-fan the pair while recording (more motion, same result).

## R6. Fan-out spreads connectors with a UI-only offset

**Decision**: Fanned connectors of a bundle share the automatic route, so drawing them as-is would overlap exactly. `routedPath` gains an optional `spread` (px, signed): curved shifts both control points along the normal of the chord; elbow adds it to the middle segment (as a render-only offset, never written to `edge.route`); straight offsets both ends along their sides. `spread = (fanIndex − (fanCount − 1) / 2) × 14`. The "×n" pill stays at the bundle's midpoint while fanned (pressed look, `aria-expanded="true"`); clicking it, Esc or a pane click folds. `fannedBundles` is UI-only, cleared on view switch, drill change and deck switch, and pruned when a bundle disappears.

Click targets: the **pill** toggles fan-out (Story 2.2); a click on the **curve** opens the bundle popover (today's merged popover, extended with select / delete per connector, FR-007). Keyboard: `E` from a focused card cycles its connections including bundles; ⏎ on a focused bundle opens its popover, like a merged connector today (`use-canvas-shortcuts.ts` `case 'enter'`), and the popover's first item is Fan out / Fold; Esc folds. At System level the pill is a small Ink dot without the number; at Landscape level only the curve shows (spec edge case, 029 zoom rules).

**Rationale**: Makes fan-out useful without touching stored routes (017) or the schema.

**Alternatives**: fan into 017 offsets written to the document (would make them "adjusted" and leave the bundle, and is a document write from a view gesture).

## R7. Outside proxies replace port pills, placed in two columns

**Decision**: `proxyLayout(deck, graph, level)` (pure, `proxy-layout.ts`) replaces `exportPortRects`' placement. For each `PortPill`: `incomingOnly` = every edge points from outside to inside. Left column: incoming-only proxies; right column: the rest. Column x = `scopeBounds.x − 150 − 72` (left) or `scopeBounds.right + 72` (right). Within a column, proxies sort by the mean y of their inside anchors and are stacked top to bottom with a 16px gap, pushed down to avoid overlap (edge case "more than about 12"). Size 150 × 52.

`OutsideProxyNode` (`port:` prefix kept, so handlers keep working): dashed 1.5px Secondary, radius 14, canvas fill, type icon (`KIND_STYLE` / `KIND_FALLBACK` from the outside node's `type`), title 12.5 / 600 one line with ellipsis, "Outside" 10 Muted. It is a `button`-role element with `aria-label="<title>, outside, press Enter to go to it"`; `draggable: false`, `selectable: false`, `connectable: false`, no handles beyond the invisible ones edges need. Click focuses it (roving `focusedId` accepts `port:` ids); double-click or ⏎ runs the existing "go to" logic (drill up, select and focus the representative, then centre it, R7a). A single click no longer jumps (FR-011, FR-012). Proxies show no connection count (frame 118 d draws none).

**R7a**: "Brought into view": after drilling up, center the real card with the existing `centredOn` helper in `requestAnimationFrame` (duration 0 under reduced motion).

**Rationale**: Matches frame 118 d (inputs left, outputs right) and FR-010 / FR-011; keeping the `port:` prefix avoids touching every handler.

**Alternatives**: proxies at the screen edge (move with pan, break export and hit-testing); one ring around the scope (harder to read, longer connectors).

## R8. "Inside <name> · n" is a canvas node on the scope's top edge

**Decision**: `ScopeLabelNode` (`scope-label:` prefix, one per drill-in) sits on the top-left of `scopeBounds` like the expanded group label in `DESIGN.md` Groups (28 tall pill, Surface, 1.5px border, 2px lip, chevron, name 12.5 / 600, count in an 18px Ink disc). Count = `graph.nodes.length` + the members of collapsed cards in scope. It is not selectable, draggable or focusable (the breadcrumb already names the level for assistive tech); its chevron is decorative. The breadcrumb (`drill-crumbs.tsx`) stays as is (FR-009).

**Rationale**: Pans and zooms with the content, so it lines up with the proxies; reuses an existing visual.

**Alternatives**: an HTML header island (does not follow the canvas; overlaps the top bar).

## R9. Export shows folded bundles and proxies, never hover

**Decision**: `export/scene.ts` calls `bundleEdges(deck, graph, { exclude: flow edges when exporting a flow, fanned: ∅, off: false })` and `proxyLayout`, and `render-svg.ts` draws the Ink "×n" pill and the dashed proxy card. Hover and pinned focus never reach export (they are UI state).

**Rationale**: 012's design update: the export preview must match the canvas.

**Alternatives**: export every connector separately (canvas and file disagree).

## R10. Measurement

**Decision**: Run `pnpm bench` before any change (save as `bench-before.md`) and after (`bench-after.md`). Add one action scenario "hover → focus painted" (target 16 ms, measured from setting `hoverFocus` through the bench hook to the next painted frame, median of 5) and a `bundleEdges` micro-timing at 500 / 1,000 in a unit test (< 2 ms, logged, not asserted in CI). The existing `focus` scenario covers pinned focus.

**Rationale**: AGENTS.md (canvas perf changes need before / after numbers); SC-001, SC-005.
