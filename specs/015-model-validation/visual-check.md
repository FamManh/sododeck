# Visual check (015)

Screenshots at 1440×900 of the production build (`vite preview`, `/deck/demo`), light and dark, in
[`screens/`](screens/). Compare with `docs/design/screens/60-problems-light.png` and
`60-problems-dark.png`.

| State                             | Ours (light · dark)                                                           | Matches                                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean deck: "No problems"         | [light](screens/no-problems-light.png) · [dark](screens/no-problems-dark.png) | PROBLEMS section first in the deck inspector, count 0, one row with a green check; no canvas button, no glyphs.                                                               |
| Two orphan components (design 60) | [light](screens/problems-light.png) · [dark](screens/problems-dark.png)       | Amber "2 problems" button next to Labels / Focus; amber triangle at each card's top-right corner; PROBLEMS · 2 with icon, title, detail and chevron rows, then the help line. |

Differences from frame 60:

- No `"problems": [...]` in the node JSON: problems are never shown in the JSON panel (§g-23, FR-010).
- The deck inspector keeps its Name / Description / Tags / Summary / Storage sections below
  PROBLEMS; frame 60 shows only the summary tiles. The Summary tiles keep 008's layout.
- The triangle glyph sits on a small amber disc (not a bare triangle) so it stays readable on the
  canvas dot grid in both themes.
- Frame 60's focused row (orange border) is our keyboard focus style (`focus-visible`); a clicked
  row selects the object instead of staying highlighted.
- The demo deck is smaller than frame 60's Logistics deck; the new cards are placed by the palette
  (they overlap Order Service, existing 003 behaviour).
