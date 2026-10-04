# Quickstart results: Table Relationships (042)

Run 2026-10-04 on branch `FamManh/feat-db-relationships` (dev server, Chrome, dark theme), with a
"Shop" deck holding `customers`, `orders`, `addresses`, `categories`, `products`, `order_items` and
`shipment_items`: one n–1 per table pair, two FKs `orders` → `addresses`, the
`categories.parent_id` self-reference, a `products` ↔ `categories` n–n, a composite
`shipment_items (order_id, product_id)` → `order_items`, and one elbow and one straight line.

## Manual walkthrough

| Step                                          | Result                                                                                                                                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Rows, sides, crow's feet                   | Pass (dark). Lines leave the `customer_id` row and reach `customers.id`; zero-or-many at `orders`, exactly-one at `customers`, rings filled with the canvas colour.              |
| 2. Curved / elbow / straight                  | Pass. Stubs on curved and elbow; the straight `order_items` → `products` line carries its marks along the line.                                                                  |
| 3. Loop, composite, two FKs, n–n              | Pass. Loop on the right of `categories`; bracket at both composite ends; two separate `addresses` lines with "ships to" / "bills to"; many marks at both n–n ends and "n–n".     |
| 4. Drag from a port                           | Pass. Dragging `customers.name`'s port onto `products.sku` created an n–1, selected it, lit its rows and showed its ports.                                                       |
| 5. Keyboard only (↓ to a row, C, type, Enter) | Covered by `table/table-ports.test.tsx` on the real canvas (row focus, Esc back to the card, popover "Connect customer_id to", keys first, filter, Enter). Not repeated by hand. |
| 6. Hover a column                             | Covered by `hover-focus/*.test.*` (rows lit, others dim, rows only in focus mode). The pointer path was seen lighting rows during step 4.                                        |
| 7. Keys / Names / zoom                        | Covered by `deck-to-flow.test.ts` (connected rows kept at Keys, title at Names, outline and "×2" bundle below 90 %).                                                             |
| 8. Deck settings                              | Covered by `inspector/deck-inspector.test.tsx` and the export scene tests.                                                                                                       |
| 9. Reconnect, composite end, delete           | Covered by `canvas-actions.test.ts` and `routing/route-handles.test.tsx`; not dragged by hand.                                                                                   |

Light theme and the 200 % check of frame 159 A were not compared by eye in this run.

## Accessibility (T054)

- Relationship edges are named from `relationshipName` ("Relationship orders.customer_id to
  customers.id, many to one, on delete restrict").
- Ends are `img`s named "exactly one", "zero or one", "one or many", "zero or many"; they differ by
  shape, so two relationships of one colour are still told apart. 1 / n notation shows the text.
- Ports are buttons named "Connect <column>" (`tabIndex -1`, reached through row focus and C).
- The type warning is a `status` chip with text ("Types differ: int → uuid").
- Lit rows take Orange Soft **and** a 600 name weight, so they read without colour.
- A composite end's handle carries the description "Edit composite column ends in the details
  drawer", and pressing it announces the same text.

## Interpretations made while building

- **Row without relationships (US3 scenario 3):** hovering or focusing such a row sets a column
  focus that lights nothing, so nothing dims while the pointer is on it, as the spec says; leaving
  the rows for the card header falls back to 034's card hover.
- **Self-loops:** `visibleGraph` used to drop every edge whose ends share a card. It now keeps a
  self-reference with column ends (other self-loops stay hidden, as before).
- **Duplicates:** the model's `duplicate-connection` problem now compares column ends, so two FKs
  between the same tables are not reported (FR-012).
- **"+n columns" pill anchor:** because Keys keeps every connected row, a relationship end only
  falls back to the pill for a stale or otherwise hidden column; the case is covered by
  `relationship-ends.test.ts` and becomes common with 048's row limit.
