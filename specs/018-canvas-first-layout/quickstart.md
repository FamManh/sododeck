# Quickstart: validating Canvas-First Layout (018)

A run guide to prove the feature works. Contracts: [contracts/shell-ui.md](contracts/shell-ui.md). State: [data-model.md](data-model.md).

## Prerequisites

- Node ≥ 24, `pnpm install` at the repo root.
- Bench baseline taken on `main` before the first code change: `pnpm bench` → keep `apps/app/bench/results/` as `specs/018-canvas-first-layout/bench-before.md`.

## Automated checks

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench   # after; compare with bench-before.md, write bench-after.md
```

Expected: all green; the smoke suite passes with only selector changes; no bench scenario drops below 60 fps at 500 / 1,000; `drawer-open-pan` holds 60 fps.

Focused unit / component runs while iterating:

```bash
pnpm --filter @sododeck/app test -- shell
pnpm --filter @sododeck/app test -- ui-store
```

## Manual scenarios (`pnpm dev`, http://localhost:5173)

Open the demo deck (`/deck/demo`) and a stored deck with ~100 components (the bench generator or an imported sample).

1. **Full-bleed (US1, SC-001, SC-002):** window 1440×900, nothing open. The canvas reaches all four edges; only the deck island, tools island, rail, history island and zoom island float over it. Open and close the outline, the drawer and JSON: the diagram does not jump or rescale.
2. **Deck island (US1):** rename the deck in place; watch the save icon go loader → check; block storage in DevTools (or use a memory deck) and see the clay alert open the error popover. Switch views; find Tidy layout and View settings in the views menu.
3. **Flyouts (US2):** ⌥2 opens Flows, ⌥1 swaps to Outline, Esc closes. Pin the outline, drag on the canvas (it stays), press C with nothing focused (palette opens), press 3 (a component of the third kind appears at the centre), palette closes and the outline returns.
4. **Flow mode (US2):** open a flow from the flows flyout: "Flow · <name>" chip in the deck island, step player bottom-centre; × on the chip exits.
5. **Problems:** create a dangling reference (e.g. a rule attached to a removed step via import); the rail Problems button shows a count, opens the list; ⌘. walks problems.
6. **Drawer (US3):** focus a component with arrows, press Enter: drawer opens, title field focused, canvas unchanged in size; Esc returns focus to the card. Double-click another card: drawer follows. Select three cards, ⌘⇧D: bulk editor. Drag the grip to ~500 px, reload the deck: width kept. Put a card under the drawer's area and open it: the canvas pans just enough.
7. **JSON (US4):** fresh deck: JSON hidden. ⌘J: overlay opens, focus inside, Selection tab follows the selection; zoom island sits above it; with the drawer open the overlay stops at the drawer. Esc: focus back to the canvas, overlay stays. Reopen the deck: JSON state remembered for this deck only.
8. **Hide UI (US5):** open a flyout + drawer, ⌘\\: only "Show UI" remains; pan, arrow-focus, Delete (confirmation shows), ⌘K work. ⌘\\ again: flyout and drawer are back.
9. **Keyboard (US6):** from the canvas press F6 repeatedly: zoom → drawer (if open) → deck → tools → rail → history → canvas. ⇧F6 reverses. Hover a rail button 400 ms: tooltip with shortcut. Press ?: shortcut list includes F6, ⌘\\, ⌘J, ⌘⇧D, ⌥1, ⌥2, V, S, G, L, C, 1–6, ⇧1, ⇧2, M.
10. **Narrow (US7):** resize to 1024×768 and 1279×800: views become a dropdown, Jump to / Labels / Focus become icons, Export icon-only, no overlapping islands; drawer ≤ ~35 % wide.
11. **Themes and motion:** repeat 1, 3, 6, 7 in dark; enable reduced motion: no slide, loader does not spin.
12. **Rule editor:** open Rules from the rail flyout → rule editor keeps its top bar layout; back to canvas restores the previous flyout / drawer state.

## Visual check

Screenshots at 1440×900, light and dark, next to `docs/design/screens/` 86–94, 115 and 116 (1024×768) in `specs/018-canvas-first-layout/visual-check.md`; list any difference (allowed: DESIGN.md token overrides, lucide icons, states owned by 016 / 017 / 019 / 020 such as the selection toolbar, Appearance section, bulk Align).
