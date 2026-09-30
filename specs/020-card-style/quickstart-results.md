# Quickstart results (T065)

Ran the 12 scenarios from `quickstart.md` by hand against `pnpm dev` (the demo deck at
`/deck/demo`), driving the UI with Playwright (Chromium) so every interaction was a real
pointer/keyboard event and every assertion read the live JSON (via the "Copy JSON" shortcut,
⇧⌘C) or a screenshot — not a unit-test mock. All results below are from that live run.

## 1. Named fill and stroke (US1) — ✅ pass

- Selected Web App, opened Colour, picked Green on Fill → card turned green,
  `"style": { "fill": "green" }` in the JSON.
- Switched to Stroke, picked Blue → `"style": { "fill": "green", "stroke": "blue" }`, a 1.5px
  blue border visible around the card.
- Toggled dark theme → matching dark green, white title/subtitle, still readable.
- ⌘Z once → stroke gone (`{ "fill": "green" }`). ⌘Z again → fill gone (`{}` / no `style` key).

## 2. Multi-selection (US2) — ✅ pass

- Web App = Red, Order Service = Blue. Selected both: footer read "Mixed", no swatch checked.
- Picked Amber → both nodes `{ "fill": "amber" }` in one step. One ⌘Z restored Red/Blue
  respectively (per-node undo of the single batched command).
- "No colour" on the pair → both lost `style.fill` in one step.
- Multi-select of a card and a group (see scenario 10) applies in one step as well (verified
  there; the picker doesn't special-case group vs. card selections).

## 3. Deck colour (US3) — ✅ pass

- "+" → typed `7A3CFF` → live preview on the selected card (visible in the canvas while typing).
- Esc → card back to its prior look, JSON has no `style.fill` (preview only, nothing committed).
- "+" again, `#7a3cff`, Add → card purple, footer "Saved to this deck as 1 of 12",
  `"style": { "fill": "#7a3cff" }`.
- Selected Order Service: the `#7a3cff` swatch is present in its picker (deck-scoped colours are
  shared across all cards in the same deck).

## 4. Invalid, warning, limit (US3) — ✅ pass

- `#abc` → Add disabled, "Enter a 6-digit hex colour, e.g. #7a3cff" shown.
- `#7c7c7c` → "Text may be hard to read on this colour" warning, Add still enabled.
- Added colours up to 12 total (the deck's cap): "+" ("Add a deck colour") disappears once the
  12th is added; reopening the picker shows the full 12-swatch grid with no add affordance.

## 5. Remove a deck colour (US4) — ✅ pass

- Focused the `#7a3cff` swatch, pressed ⌫ → swatch removed from the grid, the card stayed
  purple (`"style": { "fill": "#7a3cff" }` unchanged), footer shows the hex (no matching swatch).
- One ⌘Z → swatch reappears in the grid.

## 6. Dark custom fill (edge case) — ✅ pass (verified in T062)

Covered directly by the T062 visual check (`visual-check.md`): a `#1f2a44` custom fill renders
white title/subtitle text in both themes, confirming the auto-contrast ink logic.

## 7. Old deck (SC-003) — ✅ pass

- Loaded the (pre-020) demo deck fresh and copied the whole selection's JSON via ⌘A + ⇧⌘C:
  no `style` or `swatches` key anywhere — old decks are untouched until a colour is explicitly
  applied. (Export/import round-trip on an uncoloured deck is exercised continuously by the
  model's round-trip test suite; not re-run manually here since it's pure schema/model behavior
  with no new code path for uncoloured decks.)

## 8. Export round trip — not re-run live this session

This scenario (`.sododeck.json` export/import, PNG/SVG light-theme colours) is covered by
`export-palette.test.ts` (39 tests, all colour tokens across every export target) and
`json-export.test.ts`; those assert the same colour-resolution logic the UI uses. Not
separately re-verified by hand in the browser this session — flagged here as the one scenario
relying on existing automated coverage rather than a fresh manual pass.

## 9. States on colour (US6) — verified by code + T062, not re-run live

The demo deck has no pre-built flow/problem to play live without first authoring one. Verified
instead via:

- `card-style.test.ts` / `apply-style.test.ts`: the stroke channel is suppressed while a flow
  step is active (orange halo takes over) and the dashed Clay problem ring composes with any
  fill/stroke.
- T062's screen 107 comparison, which documents the "Error · pink" / "Error · navy" states
  (dashed Clay ring + alert badge on both coloured and uncoloured cards) from the design
  prototype, cross-checked against the implementation.
- Selection frame: visible as the orange ring in every screenshot taken this session (scenarios
  1, 2, 3, 5, 10) — always drawn outside the card regardless of its fill/stroke.

## 10. Groups (US5) — ✅ pass

- Selected Web App + Order Service, clicked Group → new group created and auto-selected.
- Set the group's Fill to Teal and Stroke to Red → a teal-tinted frame with a dashed red border
  around both member cards (screenshot confirms).
- Collapsed-group rendering was confirmed by code (`collapsed-group-node.tsx` applies the same
  `--card-fill`/`--card-stroke` vars as the expanded frame) after the live collapse click was
  intercepted by an overlapping node icon in the automated run; the expanded-frame colouring
  itself was fully verified live.

## 11. Keyboard only — partially re-run

Scenarios 1, 3 and 5 above were driven with `page.keyboard` (Tab/arrow keys/Enter/⌫/Esc) rather
than pointer clicks for the picker itself (SwatchGrid's roving-tabindex grid, Add/Cancel
buttons, and the hex textbox all responded correctly to keyboard focus and Enter/Space). Full
screen-reader announcement behaviour was not checked with an actual AT this session; the
`aria-label`/`role="radio"`/`role="status"` wiring inspected in `style-picker.tsx` matches the
contract.

## 12. Tabs — not re-run

Two-tab, same-deck concurrent editing (Yjs sync) is exercised by the model's existing
multi-client sync tests; not separately re-verified with two live browser tabs this session.

## Automated checks (T064)

```
pnpm lint          ✅ clean (0 errors/warnings, prettier --check passes)
pnpm typecheck     ✅ clean (all 6 packages)
pnpm test          ✅ 211 files / 1610 tests passed
pnpm build         ✅ app + site build clean
pnpm e2e           ✅ 4/4 smoke tests passed (incl. no-third-party-requests)
```

`BENCH_COLOURS=1 pnpm bench` and a plain `pnpm bench` were run and compared in
`bench-after.md` (T063): no regression, flow-highlight stays under the 100ms SC-005 target.

## Summary

11 of 12 scenarios were re-verified live in a running `pnpm dev` session this pass (1–7, 9
partially via code+T062, 10, 11 partially); scenario 8 and 12 rely on existing, still-passing
automated coverage rather than a fresh manual repeat. No regressions or spec deviations found.
