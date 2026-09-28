# Quickstart: Model Validation (Problems)

## Prerequisites

`pnpm install`, then `pnpm dev` (app on http://localhost:5173).

## Automated checks

```bash
pnpm --filter @sododeck/model test -- problems perf
pnpm --filter @sododeck/app test -- problems deck-node deck-edge canvas-toolbar confirm-delete use-canvas-shortcuts flow-row rule-list
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench   # before and after, numbers in bench-before.md / bench-after.md
```

## Manual scenarios

1. **List (US1):** open the demo deck → deck inspector shows "No problems". Add a component and
   leave it unconnected → "Orphan component · <title> has no connections" appears within a second.
   Duplicate a connection's source/target/label → one "Duplicate connection" row. Delete a
   connection used by a flow step → "Step without connection". Remove the catch-all row of a rule
   → "Rule without catch-all".
2. **Navigate (US2):** click each row and press ↵ on each → the object is selected and centred /
   the flow opens at the step / the rule editor opens. Press ⌘. repeatedly from the canvas, the
   inspector and the rules screen → every problem once, then wrap; ⇧⌘. goes back. Collapse the
   group of an orphan, activate its row → the group expands. Switch to a view that excludes it →
   "hidden in this view" toast with "Show in <view>".
3. **Canvas (US3):** glyphs on the orphan and on both duplicate connections (also with Labels
   off); "n problems" button in the toolbar opens the list, even in flow mode. Screen reader reads
   "Service: <title>, 1 problem".
4. **Delete (US4):** delete a component used by a flow → toast "… · 2 new problems · Undo";
   Undo → count back.
5. **JSON (SC-004):** select the orphan → the JSON panel shows no `problems` field; export the
   deck and compare with an export from before the orphan existed plus the node only.
6. **Scale (SC-003):** `/bench?nodes=2000&edges=4000&flows=1&groups=1` → typing a title and
   dragging stay smooth; the list updates within a second.
7. **Themes:** repeat 1 and 3 in dark mode; compare with `docs/design/screens/60-problems-*`.
