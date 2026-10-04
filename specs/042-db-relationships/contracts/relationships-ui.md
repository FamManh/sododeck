# Contract: relationships UI (042)

Roles, names and keys that component tests assert (Testing Library, by role and name).

## Relationship connector (`DeckEdge` relationship branch)

| Element         | Role / name                                                                                 | Notes                                                   |
| --------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Edge            | name "Relationship orders.customer_id to customers.id, many to one, on delete restrict"     | composite: "(order_id, product_id)"; n–n "many to many" |
| End marks       | `img`, names "zero or many", "exactly one", "zero or one", "one or many" (`<title>` in SVG) | 1 / n notation: the text itself                         |
| Label pill      | text as `relationshipLabel`; `data-edge-label-for` as today                                 | visibility per `relationshipDisplay.labels`             |
| No knob / arrow | relationship edges render no start knob and no end arrow                                    |                                                         |

## Column rows (041's `TableBody`, extended)

| Element      | Role / name                                                                                                                   | Notes                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Row          | `listitem` (041) with `data-row="tableId:columnId"`, `tabIndex -1` (roving)                                                   | ↓ / ↑ move between rows of a focused table; Esc returns to the card |
| Ports        | two `button`s per row, name "Connect customer_id" (left / right), hidden until row hover, connecting or selected relationship | 24 px hit area; `nodrag nopan`                                      |
| Target row   | `data-connect-target` during a drag                                                                                           | highlighted fill                                                    |
| Warning chip | `status`, text "Types differ: int → uuid"                                                                                     | during the drag only                                                |
| Lit row      | `data-lit` via hover-focus stylesheet                                                                                         | Orange Soft fill; also shown with text weight, not colour only      |

## Keys

| Key      | Context                     | Effect                                                                                                                                  |
| -------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| ↓ / ↑    | focused table / focused row | enter rows / move row focus                                                                                                             |
| C        | focused row                 | connect popover in column mode: `listbox` "Connect customer_id to", options "customers.id" (keys first), type to filter; Enter connects |
| Esc      | during a column drag        | cancel, nothing written                                                                                                                 |
| ⌫        | selected relationship       | delete (existing)                                                                                                                       |
| ⌘Z / ⌘⇧Z | after create / reconnect    | one step each                                                                                                                           |

## Drag

- Pointer down on a port, move > 4 px: ghost line from the port to the pointer (`ViewportPortal`),
  target per `columnTargetAt`; release over a target → `connectColumns`; otherwise nothing.
- Selected relationship: end handles at the row anchors; dragging a single-column end retargets
  (`reconnectColumnEnd`); a composite end snaps back and announces "Edit composite column ends in
  the details drawer".

## Deck settings (Database section, after 041's "Show on tables")

- Subheading "Show on relationships".
- `switch` "Cardinality ends" (checked by default).
- `combobox` "Labels" with options "Follow Labels tool", "On hover", "Always", "Off".
- `radiogroup` "Notation" with radios "Crow's foot", "1 / n".
- Each change: one undo step, synced to other tabs.

## Export

- SVG: each relationship is a `<path>` plus mark paths / `<circle>` rings / `<text>` marks in the
  line colour; labels as today's label pill when visible by the mode; no `<foreignObject>`.
