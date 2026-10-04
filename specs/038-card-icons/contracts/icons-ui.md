# Contract: card icons UI (038)

What a user and assistive technology can rely on. Tests assert by role and accessible name.
There is **no design frame** for the picker; it follows the 020 colour picker popover (frames 91,
105–107) and the Add palette grid. Tokens per `DESIGN.md`; icons drawn at stroke 1.5 in the picker,
as the type icon elsewhere.

## Entry points

| Where                   | Element                                                                                                                                                       | Shown when                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Selection toolbar       | `button` "Icon" (shows the current icon, or a mixed glyph) opening the picker popover                                                                         | edit mode; selection has ≥ 1 node drawn as a card                                                              |
| Context menu            | `menuitem` "Icon…" (same action `style.icon`), opens the toolbar popover                                                                                      | same                                                                                                           |
| Drawer header icon tile | the 40 px tile is a `button` "Change icon" (tooltip: current icon label or "Type icon"); pencil badge on hover / focus; opens the picker anchored to the tile | single card in the node inspector; plain tile for shapes; not in the bulk drawer, groups, stickies, connectors |

Not offered in flow mode, flow recording or the view-only editor (FR-040).

## Picker (popover, `dialog` "Choose icon")

| Element           | Role / name                                                                               | Behaviour                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Scope line        | text "Changes N cards" when the selection has non-card items or > 1 card                  | —                                                                                                      |
| Search            | `searchbox` "Search icons"                                                                | focused on open; printable keys typed anywhere in the picker go here; results update on each keystroke |
| Set filter        | `radiogroup` "Icon set"                                                                   | only rendered with 2+ sets                                                                             |
| Used in this deck | `grid` "Used in this deck"                                                                | only when the deck has custom icons; most used first; hidden while searching                           |
| Category sections | one `grid` per category, named by category label                                          | catalog order; replaced by one `grid` "Results" while searching                                        |
| Icon cell         | `gridcell` containing a `button` named by the icon label (e.g. "Search"), tooltip = label | Enter / Space / click applies and closes; current icon: `aria-selected="true"`, ring + check mark      |
| Mixed             | text "Mixed" in the header                                                                | selection's icons differ; no cell selected                                                             |
| Empty results     | text "No icons match" + `button` "Clear search"                                           | —                                                                                                      |
| Reset             | `button` "Reset to type icon"                                                             | disabled when no selected card has an icon; applies and closes                                         |
| Footer            | text: label of the focused / hovered icon, else the current one                           | `aria-live="polite"` off; purely visual echo of the accessible name                                    |

**Keys:** arrows move within a grid (2-D, `neighbour()`), ↓ from the last row / ↑ from the first
move to the next / previous section; Tab: search → first grid → … → Reset; Esc closes and returns
focus to the opener. Reduced motion: no open animation.

**Writes:** one `editor.setNodeIcon(cardIds, ref | null)` call per pick or reset = one undo step;
the canvas, outline, drawer and JSON panel update from the document.

## Rendering

| Surface                                                                      | Contract                                                                                                                                |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Card header tile                                                             | resolved icon in the type tile; the type name next to it unchanged (FR-021)                                                             |
| Landscape plate                                                              | resolved icon on the colour fill                                                                                                        |
| Collapsed group members, drill-in proxies                                    | each member / proxy shows its own resolved icon                                                                                         |
| Outline row, drawer header, step inspector, rules "used in", connect popover | resolved icon; type name shown where it is today                                                                                        |
| Command palette result                                                       | resolved icon in the item's icon slot                                                                                                   |
| Node drawn as shape                                                          | no icon (unchanged)                                                                                                                     |
| Unavailable ref                                                              | drawer tile shows the type icon + warning badge; tooltip and picker header: stored value in mono + "Icon not available in this version" |
| Colour (020) and themes                                                      | icon uses the tile's ink exactly as the type icon does today                                                                            |
