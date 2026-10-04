# Data model: Manual-test polish (051)

**No document or file-format change.** Schema v1, the Yjs layout and `.sododeck.json` output stay byte-identical. Every change below is either UI-only state (Zustand) or app/model registry data.

## Pack registry (`packages/model/src/card-types.ts`)

| Field / export                           | Change                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `PACK_LIST`                              | Order unchanged. It stays the **file order** used by `sortPacks` and `read.ts`.                                                 |
| `PACK_DISPLAY_ORDER` (new)               | `['shapes', 'process', 'data', 'database', 'architecture', 'logistics']`. It must list every `PackId` exactly once (unit test). |
| `Pack.order`                             | Now the index in `PACK_DISPLAY_ORDER`, not in `PACK_LIST`.                                                                      |
| `Pack.onByDefault` (new)                 | `boolean`. `false` for `logistics`, `true` for the rest.                                                                        |
| `NEW_DECK_PACKS`                         | `PACKS.filter(p => p.onByDefault).map(p => p.id)`, in file order. Five packs.                                                   |
| `CATEGORIES`                             | Reordered to match `PACK_DISPLAY_ORDER` (Add tabs).                                                                             |
| `LEGACY_PACKS`, `sortPacks`, `deckPacks` | Unchanged.                                                                                                                      |

Rules:

- Display surfaces (Add tabs, the Packs panel, "Packs · N on") sort by `order`. Files sort by `PACK_LIST`.
- Imported and existing decks keep their stored `packs` exactly.

## Zoom levels (`editor/levels.ts`)

| Constant         | Old                     | New                  |
| ---------------- | ----------------------- | -------------------- |
| `LANDSCAPE_MAX`  | 45                      | 30                   |
| `SYSTEM_MAX`     | 90                      | 50                   |
| `CONTAINER_MAX`  | 150                     | 150                  |
| `HYSTERESIS`     | 2                       | 2                    |
| `LEVEL_MID_ZOOM` | .375 / .68 / 1.2 / 1.75 | .2 / .4 / 1.0 / 1.75 |

Resulting bands:

| Level     | Band     |
| --------- | -------- |
| Landscape | ≤ 30 %   |
| System    | 31–50 %  |
| Container | 51–150 % |
| Component | > 150 %  |

Hysteresis transitions are as today, with the new numbers.

## UI store (`state/ui-store.ts`)

| State               | Change                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `focusMode`         | Meaning widened: it can be `true` with an empty selection, in which case hover drives the focus. It no longer auto-clears when the selection empties. It is still reset on view, drill and deck switches.                                                     |
| `hoverFocus`        | Unchanged shape. It can only be set while `focusMode && focusTargetId(selection) === null`.                                                                                                                                                                   |
| `dragCopyIds` (new) | `ReadonlySet<string>`, empty by default. It holds the node and group ids of the copies created by an active duplicate-drag. It is set by `DragController` and cleared on drop, cancel and deck switch. `deck-to-flow.ts` maps it to the `sd-drag-copy` class. |

`focusTargetId(selection, collapsed): string | null` is a new pure helper in `editor/focus-target.ts`. It returns:

- the single selected node id;
- `group:<id>` or `collapsed:<id>` for a single selected group;
- otherwise `null`.

## Duplicate-drag session (`editor/editing/drag-session.ts`)

The session gains:

| Field    | Meaning                                                      |
| -------- | ------------------------------------------------------------ |
| `mode`   | `'move' \| 'duplicate'`                                      |
| `copies` | `null`, or `{ ids: string[]; map: Map<originalId, copyId> }` |

```
move ──(moved past threshold with ⌥, or ⌥ pressed while moving)──▶ duplicate
      originals → start positions; paste copies at current positions; moving ids := copies

duplicate ──(⌥ released)──▶ move
      remove copies; moving ids := originals at current delta

any ──drop──▶ endGesture (one undo step); duplicate ⇒ select copies, announce "Duplicated n …"
any ──Esc / blur / pointercancel──▶ cancelGesture (no undo entry, copies gone)
```

The ⌥ "no group" drop target is unchanged.

## Save status (`storage/save-status.ts`)

```ts
type SaveStatus =
  | { kind: 'saved' }
  | { kind: 'pending'; since: number } // new: write queued, indicator still shows "Saved"
  | { kind: 'saving'; since: number }
  | { kind: 'error'; … }; // unchanged
```

| From    | Event         | To                                                       |
| ------- | ------------- | -------------------------------------------------------- |
| saved   | `pending`     | pending (starts the `SAVING_SHOW_DELAY_MS` = 1000 timer) |
| pending | `saved`       | saved (timer cleared, no animation)                      |
| pending | delay elapsed | saving (`SAVING_MIN_MS` = 200 hold applies)              |
| saving  | `saved`       | saved (after the hold, as today)                         |
| any     | `failed`      | error (immediately)                                      |

`SAVED_MAX_HOLD_MS` is removed (it was unused).
