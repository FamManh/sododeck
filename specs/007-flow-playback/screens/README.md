# 007 visual check

1440×900, production build (`pnpm preview`), light and dark, deck = `playbackDeck` from
`apps/app/src/test/flow-fixtures.ts` imported through the library.

| File                               | State                                    | Design |
| ---------------------------------- | ---------------------------------------- | ------ |
| `flow-step-1-{light,dark}.png`     | "Place order" opened, step 1             | 03     |
| `flow-step-4-playing-2x-{…}.png`   | step 4 playing at 2×                     | 26, 27 |
| `flow-fork-payment-failed-{…}.png` | "Checkout" fork, "payment failed" chosen | 46     |
| `flow-step-no-rule-{…}.png`        | a step with no rule and no SLA           | 24     |

## Differences from `docs/design/screens/`

Allowed:

- Rules show titles only (the compact decision table is 008); SLA shows the target only, no
  measured value (founder decision g-6).
- DESIGN.md tokens and lucide icons instead of the prototype's.

Other differences, left as they are:

- The inspector keeps 006's editable step fields (title, description, condition, SLA target)
  under the playback header; the design shows condition as a read-only code block.
- The JSON panel offers a "Step n" tab but keeps the tab the user last chose (Deck in these
  shots); the design shows the step tab selected.
- No breadcrumb over the canvas and no "Jump to…" search in the top bar (later features).
- With the JSON panel open at 1440 px, the step player overlaps the minimap's left edge; the
  design is drawn on a wider canvas.
