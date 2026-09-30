# Quickstart: Card Style (020)

A manual validation guide. Automated coverage is in the unit, model, schema and component tests. Per the [contract](contracts/card-style-ui.md), there is no new e2e test.

## Setup

```bash
pnpm install
pnpm dev            # app on http://localhost:5173
```

Open the demo deck, or import `packages/schema/examples/full.sododeck.json` (it now uses every colour). For scenario 7, also import a deck exported from `main` before this feature.

## Scenarios

1. **Named fill and stroke** (US1):
   - Select one card, press ⌘E to reach the toolbar, then open "Colour" and pick Green on Fill.
   - Expect: a green card, and `"style": { "fill": "green" }` in the JSON panel.
   - Switch to Stroke and pick Blue. Expect: a 1.5 px blue border.
   - Toggle the theme (light ↔ dark). Expect: the matching dark green, and readable title and subtitle.
   - Press ⌘Z twice. Expect: the stroke goes, then the fill.
2. **Multi-selection** (US2):
   - Select three cards with different fills. Expect: the picker footer says "Mixed" and no swatch is checked.
   - Pick Amber. Expect: all three are amber, and one ⌘Z restores each one's previous fill.
   - Choose "No colour". Expect: all three lose `style.fill` in one step.
   - Select a card and a group together and pick Teal. Expect: both change in one step.
3. **Deck colour** (US3):
   - Click "+", type `7A3CFF`. Expect: a live preview on the selected card.
   - Press Esc. Expect: the card is back to its old look, and ⌘Z has nothing new to undo.
   - Click "+" again, enter `#7a3cff`, then Add.
   - Expect: the card is purple, the footer says "Saved to this deck as 1 of 12", and `swatches: ["#7a3cff"]` appears in the JSON.
   - Select another card: the purple swatch is in its picker. Open a different deck: it is not there.
4. **Invalid, warning, limit** (US3):
   - Type `#abc`. Expect: Add is disabled and the error text is shown.
   - Type `#7c7c7c`. Expect: the "Text may be hard to read on this colour" warning, with Add still enabled.
   - Add colours until there are 12. Expect: "+" disappears and the footer explains the limit.
5. **Remove a deck colour** (US4):
   - Focus the purple swatch and press ⌫.
   - Expect: the swatch is gone, the card stays purple, and the picker shows no check with "#7a3cff" in the footer. One ⌘Z brings the swatch back.
6. **Dark custom fill** (edge case): add `#1f2a44`. Expect: white title and subtitle on the card.
7. **Old deck** (SC-003): open a deck saved before 020. Expect: it looks unchanged and the JSON has no `style` or `swatches`. Export it, then diff it against the import: identical.
8. **Export round trip**: export the coloured deck as `.sododeck.json` and re-import it as a new deck. Expect: the same colours and the same deck-colour order. Then export PNG and SVG. Expect: light-theme colours, with a custom fill as chosen.
9. **States on colour** (US6):
   - On a green card that is a flow step, play the flow. Expect: the orange border, halo and badge (the coloured stroke is hidden while the step is active), and the step is announced.
   - Give a violet card a problem (e.g. attach a decision table with no catch-all row, per 015). Expect: the dashed clay ring and the alert badge.
   - Select coloured cards. Expect: the orange frame outside the card.
10. **Groups** (US5): give a group a Teal fill and a Red stroke. Expect: a tinted frame with a dashed red border. Collapse it. Expect: a coloured collapsed card.
11. **Keyboard only**: repeat scenarios 1, 3 and 5 without a pointer, using ⌘E, Tab, the arrow keys, Enter, ⌫ and Esc. Expect: every step is reachable and announced.
12. **Tabs**: open the same deck in two tabs, and set Fill in tab A and Stroke on the same card in tab B. Expect: both colours in both tabs.

## Automated checks

```bash
pnpm schema:generate          # after editing v1.json; generate:check must be clean
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
BENCH_COLOURS=1 pnpm bench    # plus a plain `pnpm bench`; compare with the pre-change run (SC-005)
```

## Visual check

Take 1440×900 screenshots of states 91 (Appearance), 105, 106 and 107 in light and dark. Place them next to `docs/design/screens/{91,105,106,107}-*.png` in `visual-check.md`, and fix or list every difference.
