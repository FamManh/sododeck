# Data Model: Schema Editing on the Canvas (043)

043 adds one field to the file format. Everything else edits fields that 040 and 042 already define.

## File format (schema v1, additive)

### Node.locked (new)

| Field    | Type              | Rule                                                                                    |
| -------- | ----------------- | --------------------------------------------------------------------------------------- |
| `locked` | `true` (optional) | Any node type. Absent means unlocked. `false` is invalid, so unlocking removes the key. |

- **Position:** after `detail` in the Node property order (key order follows the schema).
- **Round-trip:** a locked `db-table`, a locked card and a locked shape survive JSON → Yjs → JSON unchanged.
- **Older decks:** have no key and are saved unchanged.

## Edited fields (existing)

### Column (040)

The line editor writes these columns (R2):

| Line part            | Field                     |
| -------------------- | ------------------------- |
| name                 | `name`                    |
| type                 | `type`                    |
| `(n)` / `(n,m)`      | `size` (`'10'`, `'10,2'`) |
| `pk`                 | `pk`                      |
| `not null`           | `notNull`                 |
| `unique`             | `unique`                  |
| `increment`          | `increment`               |
| `default` value      | `default`                 |
| `default` expression | `defaultExpr`             |
| enum name            | `enumRef`                 |

- **Not touched by the line:** `id`, `note`, `check`.
- **Rules kept:** `default` and `defaultExpr` are never both set (S14), and names are unique per table (refused in the editor, FR-005).

### Relationship edge (040 / 042)

Written by the menus and the toolbar:

| Field                        | Values                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `cardinality`                | `1-1` / `1-n` / `n-1` / `n-n`                                                 |
| `fromOptional`, `toOptional` | `true` or removed (`null`)                                                    |
| `onDelete`                   | `cascade` / `restrict` / `set-null` / `set-default` / `no-action`, or removed |

Line type and colour use the existing connector fields.

### Index (040)

"Add index" on a row writes `{ columns: [columnId] }` with a new id.

## Clipboard fragment (not the file format)

`{ sododeckFragment: 1, deck, external?, enums? }`:

- **`external`**: relationship edges from a copied table to a table outside the copy, with their column ids. They are kept on paste only if the target exists.
- **`enums`**: the enums that the copied columns reference. On paste, each one links to a same-named enum in the target or is copied with new ids.

Old fragments without these keys paste as before.

## UI-only state (Zustand, never saved)

| State            | Lifecycle                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `columnEdit`     | Opens on C, F2, ⏎ on a row, double-click or "Add column". Closes on ⏎ for an existing row, Esc, deselect or deck switch. |
| Line text        | Local to the editor component, lost on cancel.                                                                           |
| `rowDrag`        | From pointer down on a grip until release or Esc.                                                                        |
| `rowEditTableId` | Derived from `focusedRow`, `columnEdit` and `rowDrag`. Drives the All override in the projected deck.                    |

## Derived (pure, not stored)

- **`mismatchedColumns(deck)`**: `Map<"tableId:columnId", message>` for rows at relationship ends whose types differ (042 `typeMismatch`).
- **`isLocked(node)`**: `node.locked === true`.
- **`nextTableName(deck)`**: the first free `table_n`.
- **`copyName(name, taken)`**: `name_copy`, then `name_copy_2`, and so on.

## State transitions

```
Table: idle ──↓──▶ row focus ──⏎/F2──▶ editing row ──⏎──▶ row focus
         │            │  └─C──▶ new row ──⏎──▶ new row (next) ──Esc──▶ row focus
         │            └─Esc──▶ idle (detail back to stored)
         └─C──▶ new row (end)

Card: unlocked ──⇧⌘L / Lock──▶ locked ──⇧⌘L / Unlock──▶ unlocked
```
