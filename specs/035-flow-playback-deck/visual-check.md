# Visual check (035, T038, SC-003, SC-005)

Reference: `docs/design/screens/117-deck-sample-board-{light,dark}.png`. Screenshots in `screens/`
(production build, 1440×900, a respaced copy of the "Checkout" fork fixture imported as a deck;
the repo has no sample deck with this flow yet). `before-*` is commit `708751c`.

| Shot                               | File                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Before, step 3, light / dark       | `before-light-step3.png`, `before-dark-step3.png`                             |
| After, step 1 / 3, light           | `after-light-step1.png`, `after-light-step3.png`                              |
| After, step 3, dark                | `after-dark-step3.png`                                                        |
| After, error step 4b, light / dark | `after-light-error-step4b.png`, `after-dark-error-step4b.png`                 |
| Greyscale, steps 1, 3, 4b          | `after-grey-step1.png`, `after-grey-step3.png`, `after-grey-error-step4b.png` |
| Reduced motion, step 3             | `after-reduced-motion-step3.png`                                              |

## Matches frame 117

- ✓ stickers on played cards, a 26px orange number sticker on the lifted current card with orange lip and soft halo, dashed number stickers on upcoming cards, off-path cards faded.
- Played connectors Secondary, current orange with halo, upcoming dotted, error path dashed Clay ending in ×, with a Clay Soft ⊗ label.
- Player: 16px panel with lip, round play button on an Orange Ink lip, 8px segments, Mono speed pill, branch items with number hints and a dashed Clay error item.

## Deviations

- **Branch picker is inline in the player**, not a popover next to the decision (R8, founder flag open); the number hints are visual only, no number-key shortcut.
- Player title reads "Checkout · Step 3 of 5" (007 text kept), frame 117 reads "Step 3 of 8 Checkout".
- The numbered token is only seen mid-travel in a still; in the screenshots it peeks out under the label. Reduced motion shows it static at the label midpoint.
- Overlapping labels of a reverse pair of connectors (c→x and x→c in the fixture) are an existing label-placement behaviour, not changed here.
- Not checked in a browser: zoom below 60 % (covered by the CSS test and DOM test), 40-segment player (jsdom test only).

## No-colour reading

In greyscale: played = ✓ disc, current = filled disc with number and lift, upcoming = dashed outline; connectors differ by weight, solid / dotted / dashed, and the × end.
