# 0010. Sticky notes: display flags as document data, and freeing on node delete

- **Status:** Accepted; decisions 2–3 superseded by [ADR 0041](0041-remove-note-pinning.md)
  (notes are no longer pinned)
- **Date:** 2026-09-28
- **Feature:** `specs/009-stickies-search` (spec, research R1, R2, contracts/model-additions.md)

## Context

Feature 009 adds sticky notes as a visible, editable canvas layer (K-3) and a ⌘K command palette
(C-3, K-4). Notes already exist in schema v1 (`Sticky`, ADR 0004/0005) but are not rendered or
editable. Two behaviors need document-level state: whether a note is shown collapsed to one line,
and whether it stays at full strength during flow playback (007) instead of dimming. Both are
properties of the note itself, not of a viewer or a session, so they must survive reload, export
and multi-tab sync like every other document field (constitution I).

Separately, `removeNode` today leaves stickies anchored to a deleted node as `broken`
(ADR 0005): the anchor names nothing, and the UI has no way to show or recover the note. Once
notes are visible and editable, a note whose only anchor vanished must not become invisible or
effectively lost.

## Decision

1. **Two additive optional booleans on `Sticky`**: `collapsed` and `showInFlows`. Declared after
   `position`, both booleans with a description, no `default`. The schema version does not
   change (additive, `additionalProperties: false` unaffected). The app writes `true` or removes
   the key entirely when the flag is off — there is no stored `false` in normal use, though a
   file may still contain an explicit `false` (loaded and round-tripped unchanged).

2. **`position` is reused as the pin offset.** A pinned note's `position`, when present, is the
   offset from its anchor node's canvas position; when absent, the note uses
   `STICKY_DEFAULT_OFFSET = { x: 24, y: -96 }`. This keeps `Sticky` unchanged in required shape
   (`anchor` or `position`, already `anyOf`) — no new "offset" field is needed.

3. **`removeNode` frees pinned notes instead of breaking them** (amends ADR 0005 for node anchors
   only; founder decision Q1). In the same transaction as the delete:
   - `s.position = nodeCanvasPosition(file, nodeId) + (s.position ?? STICKY_DEFAULT_OFFSET)`
   - `s.anchor` is removed.

   `RemovalResult.freed` (new) lists these sticky ids; they are excluded from `broken`.
   `previewRemoval` reports the same list, so the confirmation dialog can say "1 pinned note will
   stay on the canvas, unpinned." Notes anchored to a deleted edge, flow, step or group are
   unchanged and still reported `broken` — ADR 0005 stands for every other anchor kind.

4. **The node grid fallback moves into `@sododeck/model`** (`geometry.ts`,
   `nodeCanvasPosition`, `NODE_GRID`), so freeing a note anchored to a node that was never given a
   stored position computes the same screen point the canvas already shows it at. The app's
   `canvas-geometry.ts` calls the model function instead of duplicating the grid math.

## Alternatives considered

- **UI-only flags** (`collapsed`/`showInFlows` in `useUiStore`): fails on reload, export/import
  and multi-tab sync (constitution I); a collapsed note would re-expand for a teammate.
- **Freeing notes in the app layer instead of the model**: would duplicate the cascade rule
  outside `@sododeck/model`, the only place Yjs ↔ JSON conversion and document invariants live
  (constitution II), and a future CLI/MCP consumer would see broken notes instead.
- **Keep the anchor but draw the note "free" (option C)**: leaves a dangling reference in the
  file (`checkIntegrity` would still report `missing-reference`), and undo would have to restore
  a fabricated "was drawn free" flag that is not actually document state.

## Consequences

- `cascade.test.ts`, `undo.test.ts`, `preview.test.ts` and `round-trip.test.ts` gain cases for the
  new fields and the freed-note cascade. Existing cases that expected a node-anchored sticky to be
  `broken` are updated to expect it `freed`, and only for node anchors — edge/flow/step anchors are
  unchanged.
- One undo restores both the node and the note's original `anchor` and `position` (one
  transaction, one undo step).
- Search (`buildSearchIndex`) and the outline read `collapsed` only for the collapsed-line
  presentation; `showInFlows` is read only by the flow-mode dimming (`stickyFlowState`, 007).
