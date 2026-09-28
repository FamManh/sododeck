# Contract: `@sododeck/model` and `@sododeck/schema` additions (011)

This adds to `specs/002-yjs-model/contracts/model-api.md`. Research: R1–R5.

## Schema (`packages/schema/schema/v1.json`)

- `View` gains six optional fields: `excludeGroups`, `excludeKinds`, `excludeTags`, `dimKinds`, `pinned` and `collapsed`, all `uniqueItems: true` (types in [data-model.md](../data-model.md)).
- `SubtitleField` gains `flows`.
- After `pnpm schema:generate`, the regenerated `types.ts` and `zod.ts` must be committed.
- The Ajv/Zod parity test must pass on the new valid example fields and the new invalid fixtures:
  - an unknown kind in `excludeKinds`;
  - a duplicate id in `pinned`;
  - a bad id in `collapsed`.
- `version` stays `1`.

## Pure exports (`packages/model/src/views.ts`, re-exported from the index)

```ts
export const VIEW_PRESETS: readonly View[]; // ids 'system' | 'feature' | 'infra'
export const PRESET_VIEW_IDS: ReadonlySet<Id>;
export function resolveViews(file: SododeckFile): readonly View[]; // stored, else presets
export function baseViewId(views: readonly View[]): Id; // views[0].id
export function nextCustomTitle(views: readonly View[]): string; // 'Custom <lowest unused n>'
export function viewPosition(file: SododeckFile, view: View, nodeId: Id): Point | undefined;
```

- `resolveViews` returns the same array identity as long as `file.views` keeps its identity, or when both are empty.
- `viewPosition` returns `view.positions[nodeId]` when present (any view, the base view included), else `node.position`, else `undefined` (the caller falls back to the grid slot).

## Editor ops (`DeckEditor`)

Every op validates first and throws `DeckEditError` without writing. If the deck has no stored views and `viewId` is in `PRESET_VIEW_IDS`, the op first writes `VIEW_PRESETS` in a separate transaction with the untracked origin (never an undo step), then applies the change.

```ts
moveInView(viewId: Id, positions: Readonly<Record<Id, Point>>): void;
setPinned(viewId: Id, nodeIds: readonly Id[], pinned: boolean): void;
updateView(viewId: Id, patch: ViewSettingsPatch): void;
addView(data?: { title?: string; type?: ViewType }): Id;
removeView(viewId: Id): RemovalResult;
setCollapsed(viewId: Id, groupId: Id, collapsed: boolean): void;
```

`ViewSettingsPatch` = `Partial<Pick<View, 'title' | 'subtitleField' | 'feature' | 'excludeGroups' | 'excludeKinds' | 'excludeTags' | 'dimKinds'>>`. A key set to `undefined` or `[]` removes the field.

| Op             | Undo                                                                | Errors                                                                                 |
| -------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `moveInView`   | tracked; merges inside a gesture or `batch`                         | `not-found` (view). Unknown node ids are skipped, not an error.                        |
| `setPinned`    | tracked, one step                                                   | `not-found`, `missing-reference` (node)                                                |
| `updateView`   | tracked; `title` keyed as `views:<id>` (a typing burst is one step) | `not-found`, `invalid` (blank title, bad kind), `missing-reference` (group or feature) |
| `addView`      | tracked, one step                                                   | none                                                                                   |
| `removeView`   | tracked, one step; undo restores every field, `collapsed` included  | `not-found`, `invalid` (last view)                                                     |
| `setCollapsed` | **untracked**: saved and synced, and `canUndo()` does not change    | `not-found`, `missing-reference` (group)                                               |

Base-view rule: when `viewId === baseViewId(resolveViews(file))`, `moveInView` writes `node.position` and deletes `view.positions[id]` if present; otherwise it writes `view.positions[id]`.

## `observeDeck`

- Changes from `setCollapsed` have origin `local` in the writing tab (the origin is registered in `editorOrigins`) and `remote` elsewhere. They never have origin `undo`.
- View changes report `scope: 'views'`, the view id and the changed keys (`positions`, `pinned`, `collapsed`, `title`, …) as today.

## Cascade and integrity

- `removeNode`: also removes the id from `pinned` in every view.
- `removeGroup`: removes the id from `excludeGroups` and `collapsed` in every view. Those views are listed in `RemovalResult.updated`.
- `checkIntegrity`: reports dangling ids in `pinned`, `excludeGroups` and `collapsed`.

## Required tests (`packages/model/test`)

- **`round-trip.test.ts`:** a deck using every new field, plus `subtitleField: 'flows'`.
- **`views.test.ts`:**
  - presets are materialized on the first op; `undo()` undoes only the change and the three views stay (`canUndo()` is false after that undo when the change was the first edit);
  - move in Infra (materializes), collapse, `undo()`: the move is undone, views and collapse stay;
  - base view with an own override (after deleting the first view): `viewPosition` returns the override; `moveInView` on it writes `node.position` and deletes the override;
  - collapse as the first change is not undoable;
  - the base-view rule;
  - pins;
  - `updateView` validation;
  - `addView` titles;
  - the last view can't be removed;
  - the collapse origin: rename, collapse, undo (the collapse is kept);
  - delete view, then undo, restores `collapsed`;
  - two docs synced see the collapse;
  - renaming a node or group keeps every view reference (constitution III).
- **`cascade.test.ts` / `integrity.test.ts`:** the new reference cleanup and reports.
