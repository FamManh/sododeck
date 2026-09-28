# Quickstart: validating Card Quick Edit (019)

This is a run guide to prove the feature works. Contracts are in [contracts/quick-edit-ui.md](contracts/quick-edit-ui.md). State is in [data-model.md](data-model.md).

## Prerequisites

- Node ≥ 24, then `pnpm install` at the repo root.
- Take a bench baseline on `main` before the first code change: run `pnpm bench` and keep the report as `specs/019-card-quick-edit/bench-before.md`.

## Automated checks

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench   # after; compare with bench-before.md, write bench-after.md
```

Expected results:

- Everything is green, and the smoke suite passes unchanged.
- No bench scenario drops below 60 fps at 500 / 1,000.
- The new `selection-toolbar-pan` scenario holds 60 fps.

Focused runs while iterating:

```bash
pnpm --filter @sododeck/app test -- quick-edit actions
pnpm --filter @sododeck/ui test -- toolbar choice-list inline-edit
```

## Manual scenarios (`pnpm dev`, http://localhost:5173)

Open the demo deck (`/deck/demo`).

1. **Rename (US1):** Double-click "Order Service" and type "Billing API". Press ⏎. The outline, the drawer (⌘⇧D) and the JSON (⌘J) all show it. One ⌘Z restores the old title. Double-click again and press Esc: nothing changes. Clear the text and press ⏎: the title is kept. Press F2 on a focused card and use Tab three times: three cards are renamed in turn.
2. **Enter still opens details, and parents still drill (FR-001):** Select a plain card and press ⏎: the drawer opens. On a component with children, press ⏎ to drill in, or right-click → Open inside. Double-click on a group label still drills in.
3. **New cards (US2):** Press C, then 2. An empty service card shows "Name this component". Type "Auth", press ⌘⏎, type "Users" and press ⏎. Add another and press Esc: "Untitled service" remains. Two ⌘Z undo the name, then the card.
4. **Details icon (US4):** Hover a card: the round icon appears top-right, and clicking it opens the drawer. Zoom out until cards are tiny: no icon appears. It does not appear in flow mode either.
5. **Toolbar (US3):**
   - Select one card: the toolbar appears above it. Set Owner by typing "pay" and picking. Set Kind.
   - Shift-select two more cards: the toolbar shows "3 selected". Set Tags "pci" once, and one ⌘Z reverts all three.
   - Select a card near the top of the window: the toolbar flips below it.
   - Pan and drag: the toolbar hides, then returns.
6. **Connections and groups (US6):** Select a connection and set Protocol with P and Direction. Press ⏎ to edit the label. Select a group: Rename, Collapse (Space), Select members (the toolbar switches to multi), and Ungroup (⌘Z restores).
7. **Menus (US5):**
   - Right-click a component, a connection, a group and the empty canvas, and compare the items with the contract.
   - On the canvas: Add component ▸ Database lands at the click point, in title edit.
   - Arrange ▸ Bring to front on an overlapping card: it draws on top and survives a reload.
   - Copy JSON, then paste into a text editor: it matches the JSON panel's Selection tab.
   - Delete shows the existing confirmation and Undo toast.
8. **Keyboard only (US7):** Arrow to a card, press ⌘E, use ← → to reach Owner, press ⏎, pick with ↓ and ⏎, then press Esc (focus goes back to the card). Press ⇧F10: the menu opens with its first item focused. Press Esc and focus returns. Press ? and check the shortcut list shows the "Quick edit" section.
9. **Modes:** In flow mode and during a recording, there is no toolbar, no icon and no inline edit, and the menu shows only Open details, Copy JSON and Fit. With Hide UI (⌘\\), the toolbar and icon are hidden, and double-click rename and right-click menus still work.
10. **Themes and motion:** Repeat 1, 5 and 7 in the dark theme. With reduced motion there is no lift animation.

## Visual check

Take screenshots at 1440×900, light and dark, and put them next to `docs/design/screens/` 95–104 and the menu part of 115, in `specs/019-card-quick-edit/visual-check.md`. List any difference. These differences are allowed:

- DESIGN.md token overrides and lucide icons
- items owned by 016 (Copy, Paste, Duplicate, Group, Align), 017 (Reset route, handles) and 020 (Fill, Stroke)
- Collapse showing Space instead of ⌘. (§g-48)
