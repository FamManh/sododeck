# Quickstart: validating Editor chrome polish

Prerequisites: `pnpm install`; `pnpm dev` (app on :5173).

## Automated

```bash
pnpm --filter @sododeck/model test      # presets, resolveViews, group descendants
pnpm --filter @sododeck/app test        # tools island, rail, zoom island, lock, code drawer, prefs
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

## Manual walk-through (maps to spec stories)

1. **US1** Open a deck. Top-right: click the gear → deck settings open. Press again → close. Menu → Deck settings opens the same panel.
2. **US2** Select a card, click Focus under Select (or press F): the rest dims. Start a flow: Focus is disabled with its reason. Top-right has no Focus.
3. **US3** New deck: tabs Overview, Flows. Open an old deck with System / Infra: unchanged.
4. **US4** Deck with a table: one `Detail: Auto` button; open it, read the four descriptions, pick Keys, ⌘Z restores Auto.
5. **US5** ⌘A then Lock: every card locked, status "Locked N cards"; drag a card, drag a group: refused. Unlock; ⌘Z/⇧⌘Z each undo the step. Lock one group only: its cards locked, siblings not.
6. **US6** Select two connected cards: hover Spread ends evenly (tooltip); select one with no shared side (reason shown).
7. **US7** Deck menu → Show DBML / SQL: drawer right. Edit DBML (canvas updates). Drag the left edge to ~900 px at 1440 wide. Open a card's details: both drawers visible, canvas strip kept. JSON panel (⌘J) shows only JSON. No Selection / Whole schema switch anywhere; with nothing selected DBML still shows the schema.

## Perf (only if group drag guards change canvas handlers)

`pnpm bench` before and after; include both in the report.
