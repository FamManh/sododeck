# Contract: typed fields UI (032)

What a user and assistive technology can rely on. Tests assert by role and accessible name. Visual
reference: frame 124 (`docs/design/screens/124-deck-typed-fields-*.png`) and 120 (cards with fields);
`DESIGN.md` "Card system (Deck)" item 4 wins where they differ.

## On the card

| Element       | Contract                                                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header status | first on-card status with a value: 21 px chip (option `chip` / `ink`, status icon) in the header's right slot; icon only under 150 px, named "<field>: <label>"                                                         |
| Chip shelf    | `list` "Fields"; select, status, person, date, dateRange chips in field order, wrapping, gap 4, no label; each `listitem` named "<field>: <value>"                                                                      |
| Rows          | text, number (Mono, with unit), link (icon + label or address, opens on click only), progress (8 px bar + Mono value) as label–value rows, min 19 tall, label 11.5 Muted; value cut to one line with full text on hover |
| "+N fields"   | `button` "N more fields" (dashed 20 px pill); opens the drawer at Fields                                                                                                                                                |
| Zoom          | Component / Container: all; System: chips as 6 px dots in the option colour (named), no rows; Landscape: none                                                                                                           |

## Drawer "Fields" section

| Element        | Role / name                                                                                                                                                                                                                                                                                                             | Keys and behaviour                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| List           | `list` "Fields"                                                                                                                                                                                                                                                                                                         | rows in field order for the card's type                            |
| Row            | drag handle `button` "Reorder <field>", kind icon, name, value control, `switch` "<field> on card" with description "Applies to every <type>"                                                                                                                                                                           | ⌥↑ / ⌥↓ on the handle move the row; one undo step                  |
| Value controls | text: `textbox`; number: `spinbutton` with unit suffix; select / status: `combobox` with options (search, colour dot, status icon); person: `combobox` with deck suggestions; date: date input; date range: two date inputs "From" / "To"; link: `textbox` "URL" + `textbox` "Label"; progress: `slider` 0–100 + number | invalid input shows a message under the control and stores nothing |
| Row menu       | `button` "<field> options" → Rename, Change kind…, Edit options… (select / status), Also use for…, Delete field                                                                                                                                                                                                         | built-ins show only reorder and the switch                         |
| Change kind    | `menu` of kinds; confirmation `alertdialog` "Change kind to <kind>? N values will be cleared." when N > 0                                                                                                                                                                                                               | one undo step                                                      |
| Delete         | `alertdialog` "Delete field · used on N cards"                                                                                                                                                                                                                                                                          | one undo step                                                      |
| Add field      | `button` "Add field" → `textbox` "Field name", `button` "Kind: <kind>" opening `menu` "Field type" (frame 124 order), options row for select / status ("+ Option"), `switch` "Show on card"                                                                                                                             | ⏎ adds, Esc cancels; announces "<field> added"                     |

## Bulk drawer

Single-type selection: the same rows; differing values read "Mixed"; setting writes all in one
step. Mixed types: only fields shared by every selected card.
