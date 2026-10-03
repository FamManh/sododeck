# Quickstart results (035, T044)

2026-10-03, production build served with `vite preview`, Playwright-driven Chromium; unit / component tests via Vitest.

| Step                                                                  | Result                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Automated checks, `pnpm lint && typecheck && test && build && e2e` | Pass. Lint has one existing warning (`canvas.tsx` react-refresh), none from 035. e2e smoke 4/4, no third-party requests.                                                                                                                                                                                                                      |
| 2. Demo walk, light and dark                                          | Done on an imported copy of the "Checkout" fork fixture (the demo deck has no flow). Step 1 and 3 stickers, lift, lip, halo, dimming, error alternative with × end and ⊗ label, leaving flow mode: see `screens/` and [visual-check.md](visual-check.md). Elbow / straight token following is covered by `deck-edge.test.tsx`, not eyeballed. |
| 3. Reduced motion and greyscale                                       | Screenshots taken (`after-reduced-motion-step3.png`, `after-grey-*.png`); states stay distinguishable. Real OS "Reduce motion" not used: emulated through Playwright's `reducedMotion`.                                                                                                                                                       |
| 4. Zoom 30 / 50 / 100 / 400 %                                         | **Not walked in a browser.** Covered by `flow-mode-css.test.ts` (lipless leaves the current lip) and `canvas.test.tsx` (stickers independent of zoom).                                                                                                                                                                                        |
| 5. Stored file unchanged                                              | Covered by `flow-mode.test.ts` (serialised deck byte-identical) and export tests (no marks). Manual export comparison not done.                                                                                                                                                                                                               |
| 6. Benchmark                                                          | [bench-before.md](bench-before.md) / [bench-after.md](bench-after.md): 71.1 → 64.3 ms, 58.4 → 58.6 fps (noisy machine).                                                                                                                                                                                                                       |

## Skipped or uncertain

- **Branch popover** (frame 117) not built: the inline 007 picker stays, with number hints. Needs a founder decision (research R8).
- `--sd-flow-token` is defined as a token but the SVG token uses fixed units (radius 12); the token documents the size only.
- Colour of a **current error** step label: Clay Soft with an orange ring (the spec says solid orange for current and Clay Soft for error; both cannot hold, so error identity wins). Needs confirmation.
- Upcoming connector colour is Secondary (spec gives only the dash).
- Chain-break badge now shows a Clay chip instead of a solid Clay fill, because the badge no longer owns its pill.
- `SVG stroke` colours use `var(--color-ink-secondary)`; verified in the screenshots that it resolves.
- The 007 text "Checkout · Step 3 of 5" differs from frame 117's order.
