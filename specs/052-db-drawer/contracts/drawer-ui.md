# Contract: Drawer UI, entry points and feedback (052)

Decisions: research R1–R4, R7–R11. Frames: 135, 136, 151–154, 164, 165 (light and dark).

## Files

```text
apps/app/src/editor/inspector/
├── inspector.tsx                       # + db-table and relationship branches
├── table/
│   ├── table-inspector.tsx             # header + DrawerTabs + panel
│   ├── drawer-tabs.tsx                 # ARIA tablist (R2)
│   ├── general-tab.tsx
│   ├── columns-tab.tsx, column-row.tsx, column-fields.tsx
│   ├── type-picker.tsx                 # enums first, then dialect groups, free text
│   ├── indexes-tab.tsx, index-parts.tsx
│   └── checks-tab.tsx
├── relationship/relationship-inspector.tsx, column-pairs.tsx, cardinality-choice.tsx
├── enum/enum-inspector.tsx, enum-values.tsx, enum-used-by.tsx
└── database/
    ├── database-section.tsx            # replaces table-display-section.tsx in Deck settings
    ├── dialect-select.tsx, dialect-confirm-dialog.tsx, apply-dialect-change.ts
    └── enum-list.tsx
apps/app/src/db/enum-edits.ts           # renameEnum, renameEnumValue, addEnumAndOpen helpers (editor in, no React)
apps/app/src/editor/fields/use-live-field.ts  # + validate option
```

## UI store

```ts
type DrawerState =
  | { open: boolean; mode: 'selection' }
  | { open: boolean; mode: 'deck' }
  | { open: boolean; mode: 'enum'; enumId: Id };

type TableTab = 'general' | 'columns' | 'indexes' | 'checks';
tableDrawer: { tab: TableTab; expandedColumnId: Id | null; focusColumnId: Id | null };

openTableDrawer(tableId: Id, opts?: { tab?: TableTab; columnId?: Id }): void; // select + open
openEnumDrawer(enumId: Id, opts?: { selectName?: boolean }): void;
dialectConfirm: DialectPlan | null;
```

None of these are saved, synced or undone.

## Entry points

| Where                             | Item / key                       | Opens                                    |
| --------------------------------- | -------------------------------- | ---------------------------------------- |
| Table menu, toolbar, ⏎ on a table | Open details                     | table drawer, General                    |
| Column row menu                   | Edit details (new `row.details`) | Columns, row expanded, name focused      |
| Relationship menu, toolbar, ⏎     | Open details                     | relationship drawer                      |
| Add flyout › Database             | Enum tile (new tool)             | new `enum_n`, enum drawer, name selected |
| Canvas menu (Database pack on)    | Add enum (new `canvas.addEnum`)  | same                                     |
| Enum chip popover                 | Edit enum                        | enum drawer                              |
| Type picker                       | New enum… / Edit enum            | enum drawer (New links it to the column) |
| Deck settings › Database › Enums  | row / Add enum                   | enum drawer                              |
| Enum drawer › Used by             | `table.column` chip              | table drawer, Columns, that row          |

## Drawer header

40 px kind tile, title, subline: table "Table · 7 columns · 2 indexes"; relationship "orders.customer_id → customers.id" with "many-to-one"; enum "Enum · 4 values". More (⋯) and Close as 018.

## Tabs

`role="tablist"` with four `role="tab"`; ← → Home End move and select; the panel is `role="tabpanel"`. Switching announces "Columns tab". Tab choice is `ui.tableDrawer.tab`.

## Validation messages

| Field             | Message                                             |
| ----------------- | --------------------------------------------------- |
| Table name        | `A table named ${name} already exists in ${schema}` |
| Column name       | `${name} is already a column of ${table}`           |
| Enum name         | `An enum named ${name} already exists in ${schema}` |
| Enum value        | `${value} is already a value of ${enum}`            |
| Any name, empty   | `${Label} can't be empty.` (existing)               |
| Pair lengths      | `From has ${a} columns, To has ${b}`                |
| Type outside list | `Not in the ${Dialect} list` (muted, not an error)  |
| n–n hint          | `SQL export writes a junction table`                |

## Confirms and toasts

| Action                      | Confirm                                                                                                                               | Toast                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Dialect change with changes | "Convert n columns from Postgres to MySQL?" rows + "+ n more · …" + "Kept as written" list; buttons Cancel (Esc), "Convert n columns" | `Converted n columns to MySQL · Undo` |
| Dialect change, no changes  | none                                                                                                                                  | `Dialect set to MySQL · Undo`         |
| Delete used enum            | "Delete order_status? 2 columns use it and keep order_status as plain type text."                                                     | `Deleted enum order_status · Undo`    |
| Remove last column pair     | "Remove the relationship? It has no other column pair."                                                                               | 043's delete toast                    |
| Delete column               | none                                                                                                                                  | 043's `deleteColumn` toast            |

All confirms use `fields/confirm-dialog.tsx` (§g-84, §g-86).

## Export dialog

`sqlBlocked = deck.blockSqlExport === true && format === 'sql' && schemaProblems(...).length > 0`. Copy and Download are `disabled` with `aria-describedby` on the banner. Banner text: `${n} errors in ${scope} · fix them to export SQL`, with "Show problems". Other formats are unchanged.

## Keyboard

Everything in the drawer is reachable with Tab. Column rows: ⏎ / Space expand, ⌥↑ / ⌥↓ move, ⌫ on the row (not in a field) deletes with 043's toast. Delete / Esc inside the drawer never act on the canvas (`inOverlay`, existing).

## Locked table

Every control is `disabled`, a note reads "Locked · unlock to edit" with an Unlock button (043's `toggleLock`).
