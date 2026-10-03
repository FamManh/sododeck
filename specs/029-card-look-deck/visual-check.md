# 029 Visual check (T063)

Captured 2026-10-03 with the Chrome browser tools against `pnpm dev` (app on :5173, 1409 x 840
viewport). The demo deck has only three cards, so denser states came from the bench page
(`/bench?nodes=12&edges=14&groups=1&lineTypes=1&colours=1&flows=1`). Dark mode was switched by
adding `.dark` to `<html>`. This was a limited pass: see "Not checked" at the end. Nothing below is
a pixel measurement; it is a side by side look.

Captures in `screens/`:

- `demo-light-rest.jpg`: demo deck, light, nothing selected.
- `demo-light-selected.jpg`: Web App selected (toolbar, handles, resize squares).
- `demo-dark-selected.jpg`: same, dark.
- `bench-light-colours-line-types.jpg`: 12 coloured cards, connectors in all three line types.

| Frame                                 | Subject                                                   | Result              | Notes                                                                                                                                                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 117 sample board                      | card frame, lip, tile, title, knob and arrow              | Match (light, dark) | 1.5px border, 3px lip, 24px tile with type name, 14/600 title, knob at the start and arrow at the end. Dark uses the dark tokens.                                                                                                                     |
| 122 states                            | selected                                                  | Match               | 2px orange outline offset from the card, round handles on the four sides, square resize handles. The card lifts 2px on hover, so the connector end sits a little off the lifted card (by design, lift is a card-only transform).                      |
| 122 states                            | problem, dimmed, dragged, current step, connection target | Not checked         | Covered only by unit tests (`deck-states.test.ts`, `deck-node.test.tsx`).                                                                                                                                                                             |
| 126 colour                            | fills, chips, strokes                                     | Match               | Fills and tile chips follow the 13 colour tokens (compared with the palette board by eye); a blue stroke makes the lip blue as in the board.                                                                                                          |
| 121 edge cases / 117 connectors       | curved, elbow, straight                                   | Match               | Elbow corners rounded, straight diagonal lines, curved lines; arrows and knobs sit on the side midpoints. Deviation: curved and straight lines cross over cards between rows, they are drawn above cards as in the app before 029 (not a 029 change). |
| 119 groups                            | expanded frame, fanned hand                               | Not checked         | The bench deck with `groups=1` did not show groups at 12 nodes. Unit tests only.                                                                                                                                                                      |
| 123 zoom levels                       | no lip below 60 %, dots at System, icon at Landscape      | Not checked         | Zoom buttons did not change the zoom from the browser tool (stayed 192 %). Unit tests only.                                                                                                                                                           |
| 125 tags                              | tag pills                                                 | Not checked         | The demo and bench decks carry no tags in view.                                                                                                                                                                                                       |
| Greyscale selected + problem (SC-003) |                                                           | Not captured        | No greyscale screenshot taken.                                                                                                                                                                                                                        |

## Bug found and fixed during the bench

Not visual: the connector arrow's rotation transform made panning and dragging 500 cards drop to
about 30 fps. Fixed with `arrowPathAt` (see `bench-after.md`).

## Not checked

Groups, zoom levels, tags, problem and drag states, flow playback, and the light/dark pairs for
frames 119 to 125. SC-008 is therefore only partly demonstrated by screenshots; the rest rests on the
unit tests. Suggest a follow-up pass on a real multi-level deck with tags, a group and a problem.
