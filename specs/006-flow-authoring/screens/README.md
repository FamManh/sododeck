# 006 visual check

Screenshots at 1440×900, light and dark, of the implemented states next to the design frames in
[`docs/design/screens/`](../../../docs/design/screens/). Deck: `packages/schema/examples/full.sododeck.json`
imported through the library. Taken with headless Chromium (Playwright) on 2026-09-27.

| Design frame                | Implementation                                             |
| --------------------------- | ---------------------------------------------------------- |
| 02 / 03 left panel          | `02-left-panel-*.png` (Features section under the Outline) |
| 41 recording, empty         | `41-rec-empty-*.png`                                       |
| 42 recording, mid           | `42-rec-mid-*.png`                                         |
| 43 recording, invalid click | `43-rec-invalid-*.png`                                     |
| 44 recording finished       | `44-rec-finished-*.png`                                    |
| 45 branch create            | `45-branch-create-*.png`, `45-branch-confirmed-*.png`      |
| 46 branch tree              | `46-branch-tree-*.png`, `46-branch-step-inspector-*.png`   |
| 47 / 48 flow filter, empty  | `47-flow-filter-*.png`, `48-flow-filter-empty-*.png`       |

## Differences from the design

Allowed (spec FR-041):

- DESIGN.md tokens: clay for error paths, invalid clicks, chain breaks and broken steps; lucide
  icons.
- A confirmation before deleting a feature, flow or branch (§g-11, §g-19).
- No playback: no player, dimming or "AT STEP n" branch picker on 44 and 46 (007).

Others to review:

- The top bar has no view switcher or "Jump to…" search yet (010/011, 009); the session chip sits
  in the centre where the switcher will go.
- The left panel of 41–45 has no bottom "Undo last step / Done" bar; those actions are in the
  top-bar chip only (one control per action).
- 45: no separate "Cancel branch" button. Esc / Cancel cancels the whole edit session, which
  restores the structure (clarification Q1). While adding a branch, the inspector shows the new
  branch only; "BRANCHES AFTER THIS STEP" is on the branch step's inspector (46).
- The JSON panel's Flow / Step tab shows the flow exactly as stored. The design's derived `n`,
  `from` and `to` fields are not in the file (FR-038).
- Owner is a text field with suggestions from the deck (`datalist`), not a select (§g-10).
- Step rows truncate long routes at the 264 px panel width; the full text is in the row's
  tooltip and accessible name.
