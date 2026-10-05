# Quickstart: validate image editing (057)

## Prerequisites

- `pnpm install`, Node ≥ 24.
- Two test pictures: a landscape screenshot (for example 1600 × 1000 PNG) and an asymmetric picture
  (an arrow pointing right) so flips are visible.

## Automated checks

```bash
pnpm --filter @sododeck/schema test     # Crop def, parity, full example uses crop / flipX / flipY
pnpm --filter @sododeck/model test      # pictureLayout, cropFrame, setImageCrop, setImageFlip, round-trip, crop-trimmed
pnpm --filter @sododeck/app test        # actions, crop mode (pointer + keyboard), image node drawing, SVG export
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench                              # before and after; numbers in the report
```

## Manual scenarios (`pnpm dev`, app on :5173)

| #   | Steps                                                                                              | Expected                                                                                                  | Spec                  |
| --- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | Paste the screenshot, double-click it, drag the top-left handle to the middle, press Enter.        | Only the bottom-right quarter shows, same scale, same place on canvas; one ⌘Z restores the whole picture. | US1-1, -2, -5; FR-008 |
| 2   | Crop again, drag inside the frame, press Escape.                                                   | Image unchanged; ⌘Z undoes the step from scenario 1 (no extra step).                                      | US1-3, -6; SC-005     |
| 3   | Crop with ⇧ on a corner.                                                                           | Frame keeps its proportions.                                                                              | US1-4                 |
| 4   | Resize the cropped image by a corner; then with ⇧.                                                 | Ratio of the cropped part held; free with ⇧.                                                              | US1-7                 |
| 5   | Open crop mode on the cropped image.                                                               | Full picture shown, current crop as the starting frame.                                                   | US1-8                 |
| 6   | Select the arrow, Flip horizontal; again.                                                          | Mirrors in place, then back; connectors, caption, size unchanged; one undo step each.                     | US2-1, -3; FR-012     |
| 7   | Flip one of two arrows, select both, Flip horizontal; press again.                                 | Both flipped (button pressed); then both unflipped.                                                       | US2-4, -5; R6         |
| 8   | Crop then flip the screenshot.                                                                     | Same region visible, mirrored.                                                                            | US2-6                 |
| 9   | Reset crop on the cropped, flipped image.                                                          | Whole picture, same scale, previous visible part in place, still flipped; Reset disabled after.           | US3-1, -2             |
| 10  | Paste the same screenshot twice, crop one.                                                         | The other is unchanged.                                                                                   | US3-4; FR-003         |
| 11  | Reload; export PNG and SVG; save the deck file and open it in a private window.                    | Crop and flip identical everywhere; SVG has a nested `<svg viewBox>` and no outside URL.                  | US4; SC-003, SC-004   |
| 12  | Open a 055 deck file and save it without editing.                                                  | Byte-identical file.                                                                                      | US4-3; SC-006         |
| 13  | Crop with the keyboard only: Tab to a handle, arrows, Enter.                                       | Works; size announced; "Crop applied".                                                                    | FR-019; SC-007        |
| 14  | Lock the image; try Crop, Flip, Reset, double-click.                                               | Disabled / locked hint.                                                                                   | FR-017                |
| 15  | Open the deck in two tabs; flip in one; start a crop in the other and move the image in the first. | Flip shows in the other tab; crop confirms on the moved image.                                            | US4-8; R9             |
| 16  | Hand-edit a file so `crop.x + crop.width = 1.2`; open it.                                          | Deck opens, crop trimmed to the picture edge, one problem reported.                                       | FR-016; R10           |

Record screenshots of scenarios 1, 6, 9 and 11 (light and dark) under `screenshots/` (git-ignored
locally as in 053 / 055 unless the founder asks to commit them).
