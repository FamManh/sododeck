# Quickstart: validating Flow Playback "Deck"

Prerequisites: Node ≥ 24, `pnpm install`. Commands run from the repo root. Contracts: [contracts/playback-marks-ui.md](contracts/playback-marks-ui.md). Data rules: [data-model.md](data-model.md).

## 1. Automated checks

```bash
pnpm --filter @sododeck/app test -- step-marks flow-overlay step-sticker flow-token deck-edge deck-node collapsed-group step-player branch-picker flow-mode-css
pnpm --filter @sododeck/ui test -- contrast tokens-only
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

Expected: all green; no skipped or `.only` tests; smoke suite still passes (no third-party requests).

## 2. Walk the demo flow (light, then dark)

1. `pnpm dev`, open the demo deck, open the flow "Checkout" (paused, step 1).
2. Step 1: start card ✓, step-1 target lifted on an orange lip with a number sticker, later cards with dashed numbers, the rest at 22 %.
3. Press → to step 3: lip and large sticker move; earlier cards ✓; token (numbered disc) travels the current connector.
4. Press ← : the previous card becomes current; the card you left returns to a dashed number.
5. Switch a connector to elbow and straight (029): the token follows each.
6. At a fork, switch to the error alternative: dashed Clay connector ending in ×, ⊗ label, other alternative dimmed with no stickers.
7. Leave flow mode: no stickers, lips, halos or dimming remain.

Compare against `docs/design/screens/117-deck-sample-board-{light,dark}.png`. Save screenshots to `specs/035-flow-playback-deck/screens/` and note deviations in `visual-check.md`.

## 3. Reduced motion and greyscale

- Enable "Reduce motion" in the OS: step through; no lift, token movement or fades; lip, stickers and a static numbered token remain.
- Take a greyscale screenshot (or devtools "emulate vision deficiency: achromatopsia") of steps 1, 3 and an error step: played / current / upcoming and the error path are still distinguishable.

## 4. Zoom

Zoom to 30 %, 50 %, 100 %, 400 % during playback: card size never changes; the current card keeps its lip and sticker below 60 %; played and upcoming stickers stay visible.

## 5. Stored file unchanged

Export `.sododeck.json` before and after a playthrough: byte-identical (SC-007). Export PNG / SVG with a flow open: no stickers, lip or token (R10).

## 6. Benchmark

```bash
pnpm bench   # before the change: save to bench-before.md
pnpm bench   # after: save to bench-after.md
```

Report "next step → current painted" (target ≤ 100 ms) and "playing at 2×" (no lower than 029's 59.2 fps), with the machine load noted and the median of 5.
