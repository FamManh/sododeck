# Visual check (T061)

Screenshots at 1440×900, light and dark, of frames 02, 04, 10, 18, 23, 28, 29, 49, 50, 51 and 58,
taken with headless Chromium (Playwright) on `pnpm dev` on 2026-09-27, with the deck
[`screens/logistics.sododeck.json`](screens/logistics.sododeck.json) imported through the library.

| Design frame               | Implementation (`screens/`, `-light` / `-dark`) |
| -------------------------- | ----------------------------------------------- |
| 02 component               | `02-node-*.png`                                 |
| 18 markdown preview        | `18-markdown-preview-*.png`                     |
| 23 inspector scrolled      | `23-inspector-scrolled-*.png`                   |
| 49 connection              | `49-edge-*.png`                                 |
| 50 flow                    | `50-flow-*.png`                                 |
| 51 step (no meter)         | `51-step-*.png`                                 |
| 10 deck                    | `10-deck-*.png`                                 |
| 58 bulk                    | `58-bulk-*.png`                                 |
| 04 rule editor, match      | `04-rule-editor-*.png`                          |
| 28 rule editor, no match   | `28-rule-no-match-*.png`                        |
| 29 rule editor, other rule | `29-rule-other-*.png`                           |

Differences from `docs/design/screens/` (allowed ones first):

- Allowed: DESIGN.md tokens (success green for a match, clay for no match and errors), lucide
  icons, SLA target only (no meter or measured value), owner as a combobox styled like a select.
- Connection inspector header reads "<from> → <to>" with "Connection · <id>" (UI contract); the
  design shows the label as heading. Protocol offers the popover's six choices plus "Not set"
  (the design shows five). Direction is a segmented control like the popover, not a select.
- Rule editor: the rule name is an inline text field labelled RULE NAME instead of a large title,
  and the description sits below the header as a Write / Preview field. Each row shows its delete
  button (×) and a grip at all times; each column header has a "⋯" menu (Rename, Remove).
  "Delete rule…" is a header button rather than a menu item.
- The step's rule card shows the full compact table in the 336 px inspector; with six columns the
  headers wrap and the table scrolls horizontally.
- Flow summary line (design 50) and USED IN FLOWS (49) read "<flow> · Step n" without "of m".
- Grid rows use a drag grip that is hidden from assistive technology; keyboard users move rows
  with ⌥↑ / ⌥↓ (the contract's "Drag row n" button name is not provided).

Grayscale check: the matched row carries a check icon, a bold number and `aria-selected`; no
match has an alert icon and text; Mixed is italic with the accessible description "Mixed values";
partial tags are dashed with "k/n"; invalid cells have an alert icon and "Not a valid condition".
