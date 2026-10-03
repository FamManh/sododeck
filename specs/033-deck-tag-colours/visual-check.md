# 033 visual check

Screenshots in `screens/` (light and dark, demo deck, 1440×900, built app): `picker-*` (search "pa", one tag created from the picker), `editor-*` (tag editor, violet chosen for "PCI"), `deck-*` (card pills after colouring "PCI" violet and "critical" red). Reference: frame 125 (`docs/design/screens/125-deck-tags-light.png` / `…-dark.png`).

Matches: pills take the tag colour (slate for none) on the card and in the drawer row (21 px with ×, dashed "Add tag" pill); the picker has the search field with the orange focus ring, a "Deck tags" caption, rows with check, colour ring dot, name, count and pencil, and a "Create tag “…”" row; the editor has the 13 swatches with the checked ring, and the delete line with the usage count; dark theme uses the same tokens.

Differences from frame 125 (founder to decide if any should change):

1. The editor has no "+" swatch for a new custom colour. Deck colours (`swatches`) are listed in the same grid after "No colour", not in their own "Deck colours" row. New custom colours are still added through the card colour picker (020).
2. "No colour" is an empty ring swatch at the end of the 13 (the frame has none; the contract asks for it).
3. The editor header reads "EDIT TAG · <tag>" with a Back arrow; the frame shows "EDIT TAG" and a name field only. The name field is below it.
4. The "Create tag" row has no ⏎ key hint.
5. The pencil is always visible on a row (the frame shows it on the focused row).
6. The picker is not constrained to the viewport on a narrow right edge beyond what Radix does by default (not checked at small widths).

Not checked by eye: the 10-tag card at Container level, System-level dots (covered by tests), and the export image (covered by scene and SVG tests).
