# 029 Quickstart results (T064)

Walked 2026-10-03. "Walked" means done by hand in the browser; "tests" means covered by automated
tests only, not walked.

| #     | Scenario                                                | Result                                                                                                                                                                 |
| ----- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Demo deck in the Deck look; JSON identical              | Look walked (light and dark, see `visual-check.md`). JSON equality: tests only (`demo deck json is unchanged by the deck look`, commit 0626ae7); not exported by hand. |
| 2     | Compare with screens 117, 119 to 122, 125, 126          | Partly walked: 117, 122 (selected), 126. 119, 121 (edge cases), 125 not walked.                                                                                        |
| 3     | Hover, select, drag a card with a problem; greyscale    | Selected and hover walked. Problem, drag and greyscale not walked; tests only.                                                                                         |
| 4     | Zoom 30 to 400 %; constant size, no lip below 60 %      | Not verified: browser zoom control did not respond. Tests only (`card-layout`, level tests).                                                                           |
| 5     | Select 3 connectors, Line type Straight, undo           | Not walked. Tests: `connection-actions`, `line-type`, model `setEdgeShape` one undo step.                                                                              |
| 6     | Old deck elbow offset, Curved to Elbow restores segment | Not walked. Tests: model round trip (offset kept when leaving elbow).                                                                                                  |
| 7     | Pick Elbow, new connector, reload, another              | Not walked. Tests: `lastLineShape` in `connectComponents` (memory only).                                                                                               |
| 8     | Collapse group, fanned hand, Enter expands              | Not walked. Tests: `collapsed-group-node`, `merged-edge`.                                                                                                              |
| 9     | Export SVG and PNG of the demo deck                     | Not walked in the browser. Tests: `render-svg`, `scene.perf`; the bench's PNG export scenarios pass (dialog, preview, 2x download).                                    |
| 10    | Reduce motion, hover cards                              | Not walked.                                                                                                                                                            |
| Bench | After bench with `BENCH_LINE_TYPES=1`                   | Done, see `bench-after.md` (a pan/drag regression from the arrow transform was found and fixed).                                                                       |
