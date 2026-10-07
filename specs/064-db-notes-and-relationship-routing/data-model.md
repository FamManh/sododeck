# Data model: 064

No file format change. `packages/schema/schema/v1.json` is untouched. One model fix (`setEdgeStyle`).

## Document data (Yjs, existing)

| Entity                | Field                                             | Use in 064                                                                                            |
| --------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Node` (`db-table`)   | `description`                                     | The table note. No longer drawn under the title; shown in the table popover.                          |
| `DbColumn`            | `note?: DbNote`                                   | Column note, shown in the column popover; drives the row note icon.                                   |
| `DbColumn`            | `default`, `check`, `increment`                   | Never drawn on a row; their presence makes a row "hidden" (popover available).                        |
| `Edge` (relationship) | `style.shape?: 'curved' \| 'elbow' \| 'straight'` | Per-relationship line type. Absent = elbow for a relationship (`edgeShape`).                          |
| `Edge` (relationship) | `route.waypoints?`                                | Bends, encoded relative to the two table centres (`encodeWaypoint`). Kept when the shape is straight. |
| `Deck.tableDisplay`   | `hideNotes?: boolean`                             | Meaning changes: hides the note icons (canvas and export). No longer affects height.                  |

### Model fix: `setEdgeStyle` (packages/model/src/ops/edge-style.ts)

- Today: `shape: 'curved'` is removed unless `route.offset` exists.
- After: `shape` is removed only when it equals the edge's default shape, i.e. `edgeShape({ ...edge, style: { ...edge.style, shape: undefined } })`. For a relationship (default elbow) `curved` is stored; `elbow` is removed. For a card connector behaviour is unchanged.
- Tests: ops test for both edge kinds; round-trip case with a relationship carrying `style.shape: 'curved'` and `route.waypoints`.

## Derived layout (app, pure, cached)

`TableLayout` (`editor/table-layout.ts`):

| Field                  | Change                                                                           |
| ---------------------- | -------------------------------------------------------------------------------- |
| `noteLines`, `noteCut` | Removed.                                                                         |
| `hasNote`              | New. `description.trim() !== ''` and `!display.hideNotes` → header icon.         |
| `noted`                | New. `description.trim() !== ''` (popover available even when icons are hidden). |
| `height`, `rowsTop`    | No note term.                                                                    |

`TableRow`:

| Field     | Change                                                                                      |
| --------- | ------------------------------------------------------------------------------------------- |
| `hasNote` | New. Non-empty column note and `!display.hideNotes` → row icon; `nameMax` reserves 16 px.   |
| `hidden`  | New. `note` non-empty \|\| `nameCut` \|\| `typeCut` \|\| default \|\| check \|\| increment. |

## UI state (Zustand, UI-only)

```ts
interface DbPopover {
  kind: 'column' | 'table';
  nodeId: Id;
  columnId?: Id; // kind === 'column'
  source: 'hover' | 'keyboard' | 'click';
}
// ui-store
dbPopover: DbPopover | null;
openDbPopover(target: DbPopover): void; // closes enumPopover
closeDbPopover(): void;
```

- `openEnumPopover` closes `dbPopover` (FR-011).
- Cleared on flow open, reset, canvas gesture start, and when the target node/column disappears.
- No document data is copied: the popover reads the column/table from the deck by id on render.

## State transitions (popover)

```
closed --hover rest 300ms (row.hidden / table noted, not suspended, not touch)--> open(hover)
closed --icon click/tap--> open(click)
closed --keyboard focus rest--> open(keyboard)
open(hover) --pointer to another row/header of same table--> open(hover) on new target, no delay
open(hover) --leave row and popover, 150ms grace--> closed
open(*) --Escape | outside click | drag/gesture starts | enum popover opens--> closed
open(click) --icon click again--> closed
```
