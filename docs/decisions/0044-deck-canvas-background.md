# 0044. Deck canvas background (pattern and colour) in the file

- **Status:** Accepted
- **Date:** 2026-10-06
- **Feature:** founder feedback (2026-10-06), deck settings

## Context

The canvas has always drawn 1px dots every 22px on the theme's canvas colour (`--sd-canvas`,
`--sd-dot`), light or dark. The founder asked for a deck setting to change it: a pattern (dots,
grid, none) and a free colour from a colour picker (any hex). The choice belongs to the deck, so
it must travel with the `.sododeck` file, and it must not break dark mode for decks that do not
set it.

## Decision

1. **One optional root key, no version bump.** `canvasBackground` (`$defs/CanvasBackground`),
   declared after `groupingMode`, `additionalProperties: false`:
   - `pattern`: `"grid" | "none"`. Absent is dots, so `"dots"` is invalid when stored (the same
     rule as `relationshipDisplay.notation`: a default is the absent key).
   - `color`: `HexColor` (lowercase `#rrggbb`, the same type as card colours). Absent follows the
     theme.
     The editor removes a key set back to its default and the object when it is empty, so a deck
     that never touches the setting is written back byte-identical.
2. **Stored like the other deck display maps.** `@sododeck/model` keeps it in
   `meta.canvasBackground` exactly as `meta.relationshipDisplay` (a `Y.Map` created by
   `fromJSON`, attached on first write for older stored documents, per-key writes so two tabs
   changing different keys keep both). `editor.setCanvasBackground(patch)` writes it in one undo
   step; `canvasBackgroundOf(file)` fills in the defaults.
3. **Theme by default.** With no colour, the canvas sets nothing and the theme tokens apply, so
   light and dark both keep today's look. A stored colour is the same in both themes: it is the
   user's explicit choice.
4. **Pattern colour is derived, not a token.** A token has one value per theme, but a custom
   colour can be light in dark mode or dark in light mode, so a token (even with opacity) can
   vanish or glare. The dot / line colour is the background moved 16 % toward black when dark
   text reads best on it (the same luminance switch cards use for text, 020) and toward white
   otherwise. 16 % gives about the contrast of the theme's own dots on its canvas (≈ 1.2–1.4:1),
   so the pattern stays quiet on any colour.
5. **Applied as CSS variables on the canvas root.** `--color-canvas` and `--color-dot` are
   overridden on the React Flow root only, so the background, its pattern and every
   canvas-coloured knockout inside the canvas (relationship rings, Outside proxies) follow the
   colour; the chrome around it keeps the theme.
6. **Images.** PNG / SVG export already fills the image with the canvas colour unless
   Transparent is on; it now uses the stored colour. Images never drew the dots, and still do not
   draw a pattern. Card colours in images stay light (images are light-only, 012 R2).

## Consequences

- Older apps opening a file with `canvasBackground` reject the unknown key, like every other
  additive key since v1; files without it are unchanged.
- A dark custom colour in a light image keeps light-theme cards and dark ink labels on the
  canvas (group titles, actor names); the user chose the colour, so this is accepted.
