# Quickstart results (022)

Checked in Chrome against `pnpm exec vite` with the bench deck
(`/bench?nodes=12&edges=14&bends=1&animated=1`, dark theme), plus the automated suites.

| Step                                   | Result                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 5 Bends                                | Handles (midpoint rings, bend dots) appear on the selected connector; dragging a bend moved it and the line followed. |
| 10 Animate                             | Dashed and solid connectors with `animated` draw moving dashes on the canvas.                                         |
| 1–4, 8, 9                              | Covered by component tests (popover, drawer, menu, label, anchors); **not walked by hand**.                           |
| 6, 7, 11                               | Covered by unit tests (bends follow cards, 017 offset conversion, pre-022 export); not walked by hand.                |
| Light theme, screenshots in `screens/` | **Not done.**                                                                                                         |
| 12 Network                             | The smoke suite's third-party check covers CI.                                                                        |
