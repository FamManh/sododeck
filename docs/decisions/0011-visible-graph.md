# 0011. Visible graph derivation and UI-only zoom/group/focus state

- **Status:** Accepted
- **Date:** 2026-09-28
- **Feature:** `specs/010-zoom-groups-focus` (spec, research R1, R2, R8, contracts)

## Context

Feature 010 keeps large decks readable without changing the document: semantic zoom shows one level
of detail at a time, drill-in shows only one scope, collapsed groups replace many edges with one
merged edge, and focus mode dims everything except one local neighbourhood. Constitution I and the
app rules forbid storing any of that in React Flow, Zustand as document data, or the deck itself.
The JSON panel and export must stay byte-identical before and after any of these interactions.

The canvas already follows ADR 0006: React Flow is a controlled view derived from the deck
snapshot. Feature 010 needs to preserve that rule while adding derived cards, merged edges and
port pills, and while keeping large decks fast enough for the benchmark targets.

## Decision

1. **One pure visible-graph derivation.** `editor/visible-graph.ts` is the single derivation from
   the deck snapshot plus UI ids (`scope`, `collapsed`) to what the canvas shows:
   visible nodes, expanded group boundaries, collapsed cards, plain edges, merged edges and port
   pills. It also computes representatives, hidden-by relations and child counts. `Canvas`
   memoizes it and `deck-to-flow.ts` consumes it. React Flow never decides visibility itself.

2. **Drill, collapse and focus are per-tab UI state only.** The UI store keeps:
   - a drill stack of group/component frames with the viewport to restore,
   - a collapsed-group id set,
   - a focus-mode boolean plus ordinary selection/focus ids.

   None of these are written to the deck, JSON panel or export. They reset on deck reload and are
   pruned when the referenced objects disappear.

3. **Children stay hidden until their parent is drilled into.** A node whose effective `parent`
   resolves to `P` is visible only in scopes with `node === P`. At the top level and in unrelated
   scopes it is absent, even when it belongs to a visible group. The visible graph computes this,
   so every canvas surface follows the same rule.

4. **Level comes from one discrete zoom selector with hysteresis.** `Canvas` reads the viewport
   zoom through one module-scope React Flow selector and maps it to
   `landscape | system | container | component`. A 2-point hysteresis stops flicker near
   boundaries, and drilling into a component forces the effective level to `component`.

5. **Focus dims by CSS plus accessibility flags.** Focus mode marks the small member set and dims
   the rest through wrapper CSS, but dimmed objects also get `aria-hidden` and `inert` so they are
   neither interactive nor reachable to assistive tech.

## Alternatives considered

- **React Flow `hidden` flags on nodes and edges:** rejected because merged edges, collapsed cards
  and port pills are derived objects, not toggles on the original objects, and React Flow would
  still own too much visibility state.
- **A worker for visible-graph derivation:** rejected because the derivation is linear and fast on
  the benchmark scale, while a worker round-trip would add click-to-paint latency to collapse,
  drill and focus.
- **Persisting `collapsed` on the group object:** rejected because collapse is a viewer choice for
  this tab and view, not document data, and must not affect export, undo or another tab.
- **CSS-only focus dimming:** rejected because opacity alone would leave dimmed objects reachable to
  screen readers and keyboard focus, violating the accessibility requirements.

## Consequences

- `visible-graph.ts`, `levels.ts`, `focus-set.ts` and `collapse-flow-marks.ts` are pure modules
  with unit tests; canvas tests cover drill, collapse, focus and zoom behavior without any document
  writes.
- `deck-to-flow.ts` gains prefixed synthetic ids for collapsed cards, merged edges and port pills.
  These ids stay view-only and never enter the deck.
- Undo history, JSON text and export stay unchanged across zoom/group/focus interactions, and the
  benchmark can measure them independently from document edits.
