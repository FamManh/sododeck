# Quickstart: Connector Style (022)

How to check the feature works. Behaviour details: [spec.md](spec.md); names and keys:
[contracts/connector-ui.md](contracts/connector-ui.md); data: [data-model.md](data-model.md).

## Prerequisites

- `pnpm install`, Node ≥ 24.
- Bench baseline taken **before** any canvas change: `pnpm bench` → copy the summary to
  `bench-before.md`.

## Automated checks

```bash
pnpm schema:generate                 # after editing v1.json; diff must show only the new keys
pnpm --filter @sododeck/schema test  # Ajv / Zod parity, S9–S11 invalid fixtures
pnpm --filter @sododeck/model test   # setEdgeStyle / setEdgeRoute / setEdgeLabelAt, undo, round-trip, 017 offset conversion
pnpm --filter @sododeck/app test     # connector-geometry, line-colour, bend-drag session, popover, handles, label, export scene
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench                           # → bench-after.md, plus the 200-animated / 200-bent variant
```

## Manual walk (pnpm dev, http://localhost:5173)

Use the demo deck, light then dark theme. Record results in `quickstart-results.md` with screenshots
in `screens/`.

1. **Style (US1).** Select one connector → toolbar "Line style" → Dashed, weight 3, Blue. Line
   updates per pick; ⌘Z three times restores it. JSON overlay (⌘J) shows `"dash": "dashed"`,
   `"width": 3`, `"color": "blue"`; set them back to defaults and the `style` keys disappear.
2. **Mixed (US1).** Select three connectors with different dashes → popover shows "Mixed" on Dash
   → pick Dotted → all three dotted, one ⌘Z restores all.
3. **Keyboard (US1).** With only the keyboard: focus the toolbar, open Line style, set every
   section, Esc → focus on "Line style".
4. **New connector (US1 #8).** After step 1, draw a new connector: default look, no `style` in JSON.
5. **Bends (US2).** Select an elbow connector → drag the midpoint handle down-left → a bend appears,
   "1 bend" readout, dashed ghost while dragging. Move it in both axes; it snaps to the neighbour's
   line and to the dots. Drop it in line with its neighbours → it disappears. Double-click a bend
   → removed. Switch to curved and straight: curve passes through the bends; straight hides them.
6. **Bends follow cards (US2 #7, #10).** Move one card: bends stretch. Select both cards and move
   them: the line keeps its exact shape. Open a saved view with other card positions: bends sit
   between the cards there. Run auto-layout: bends stay near their cards.
7. **017 deck (US2 #9).** Import a file with `route.offset` (`packages/model/test` fixture): same
   look as before; move a bend → no jump, JSON shows `waypoints` and no `offset`; Reset route →
   automatic.
8. **Anchors (US3).** Drag an end along the right side: readout "right side · 25 %", snaps at
   quarters, Esc cancels; drop on the card body → automatic. Resize the card: the end stays at 25 %.
9. **Label (US4).** Drag "charge" toward the source: "label 20 %", ticks, snapping; move a card →
   label stays at 20 %; keyboard ← → / Shift / Home / End.
10. **Animate (US5).** Turn on Animate direction for a forward and a two-way connector → dashes run
    toward the arrow(s). Turn on reduced motion (OS setting) → still. Play a flow → paused, flow
    look wins; close → runs again. Export PNG and SVG → still lines with the chosen dash, weight,
    colour, bends and label position.
11. **Older decks (US6).** Open a deck saved before 022, edit card text, export: no 022 keys added.
12. **Network.** DevTools network panel during all of the above: no requests beyond the app's own
    assets (the smoke suite's third-party check covers CI).

## Expected bench outcome (SC-007)

- 500 / 1,000 deck without 022 data: within run-to-run variation of `bench-before.md`.
- 200 animated connectors: pan ≥ 60 fps.
- 200 connectors with 3 bends each: pan and drag within the existing canvas targets.
