# Contract: card type UI (030)

What a user and assistive technology can rely on. Tests assert by role and accessible name. Visual
reference: frame 127 (`docs/design/screens/127-deck-type-palette-light.png`, `…-dark.png`), cards
from frame 120; `DESIGN.md` wins where they differ. No UI copy says "kind" (clarify Q1).

## Add flyout (rail "Add")

| Element | Role / name                                                                                                          | Keys and behaviour                                                                                                                                                         |
| ------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flyout  | existing `Flyout` "Add" with pin and close                                                                           | Esc clears the search, then closes (unpinned) and returns focus to the rail button.                                                                                        |
| Search  | `searchbox` "Search types" (placeholder "Search types…", `/` hint)                                                   | `/` focuses it while the flyout is open; typing filters by name (case ignored); ⏎ adds the first match; ↓ moves to the first tile. "No types match" when empty.            |
| Tabs    | `tablist` "Categories": `tab` All, Architecture, Process, Logistics, Data (only categories whose pack is on)         | ← → move, selection follows focus; the chosen tab filters sections.                                                                                                        |
| Section | `group` named by the category, heading with the count                                                                | Hidden when it has no visible tile.                                                                                                                                        |
| Tiles   | `grid` "Types"; each tile a `gridcell` `button` "<Name>" with icon; number badge 1–9 on the first nine visible tiles | Arrows move in 3 columns; ⏎ / Space adds at the view centre with the title in edit; drag places where dropped; 1–9 add while the flyout is open. Announces "<Name> added". |
| Footer  | `button` "Packs · N on"                                                                                              | Opens the packs view in the same flyout.                                                                                                                                   |

## Packs in this deck

| Element  | Role / name                                          | Keys and behaviour                                                                                                                      |
| -------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Header   | `button` "Back to Add", heading "Packs in this deck" | Esc or Back returns to Add.                                                                                                             |
| Pack row | text "<Pack>" and "<n> types"; `switch` "<Pack>"     | Space toggles; one undo step; announces "<Pack> on / off". The last pack on: switch disabled, description "At least one pack stays on". |
| Note     | text                                                 | "Turning a pack off hides its types from Add. Cards already on the board keep rendering."                                               |

## Type picker (toolbar, drawer, bulk drawer, menu)

| Element             | Role / name                                                    | Behaviour                                                                                                                             |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Toolbar button      | `button` "Type: <Name>" or "Type: Mixed"                       | Opens the existing field popover with a filter field "Filter types".                                                                  |
| Drawer / bulk field | labelled "Type"                                                | Same options.                                                                                                                         |
| Options             | `listbox` with `option` per type, grouped by category headings | Types of packs that are on, plus each selected card's current type (marked). Picking applies to every selected card in one undo step. |

## Card and other places

- Card header: type tile (`TYPE_STYLE` icon and tone) and the type name; unknown type → fallback
  tile and the raw id as the name.
- View settings: "Hide types" and "Dim types", listing types in use plus types of packs that are on,
  grouped by category.
- Search results and the command palette show the type name; searching a type name finds its
  cards.
- Export (PNG / SVG) and the library thumbnail draw every type's icon; unknown → fallback.

## Tile tones and icons

As research R3. Every built-in type has an icon in `TYPE_STYLE` and in the export `ICON_PATHS`
(test-enforced).
