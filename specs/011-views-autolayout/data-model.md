# Data Model: Saved Views and Auto-Layout (011)

Sources: [spec.md](spec.md) and [research.md](research.md) (R1–R11). This page covers three things:

- **Document data**: the `.sododeck.json` fields and their Yjs mirror, owned by `@sododeck/schema` and `@sododeck/model`.
- **UI state**: the Zustand store, per tab, never saved.
- **Derived models**: pure, never saved.

## 1. Document data

### View (schema `View`, extended)

| Field           | Type                                             | Req. | New     | Notes                                                                                                                                                                                             |
| --------------- | ------------------------------------------------ | ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | `Id`                                             | ✔    |         | Stable. Presets use the fixed ids `system`, `feature` and `infra` (R3). Custom views get `view-…` ids.                                                                                            |
| `type`          | `system` \| `feature` \| `infra` \| `custom`     | ✔    |         | Picks the default settings and the tooltip only (FR-002a).                                                                                                                                        |
| `title`         | `Text`                                           | ✔    |         | Non-empty after trim (FR-041). Duplicates are allowed.                                                                                                                                            |
| `subtitleField` | `tech` \| `host` \| `owner` \| `flows` \| `none` |      | `flows` | Absent means `tech`.                                                                                                                                                                              |
| `feature`       | `Id` → feature                                   |      |         | Limits the view to components on that feature's flows (FR-014). Cleared when the feature is deleted (existing cascade).                                                                           |
| `includes`      | `IdList` → nodes                                 |      |         | An explicit whitelist, honoured when present; the UI doesn't edit it.                                                                                                                             |
| `excludeGroups` | `IdList` → groups, unique                        |      | ✔       | Hides the members of these groups, nested groups included.                                                                                                                                        |
| `excludeKinds`  | `NodeKind[]`, unique                             |      | ✔       |                                                                                                                                                                                                   |
| `excludeTags`   | `Tags`, unique                                   |      | ✔       | A component is hidden if it has any of these tags.                                                                                                                                                |
| `dimKinds`      | `NodeKind[]`, unique                             |      | ✔       | Infra preset: `['client']`.                                                                                                                                                                       |
| `positions`     | `{ [nodeId]: Position }`                         |      |         | Overrides per view. A move in the base view writes `node.position` and drops that view's own entry; entries on a base view only exist when it became the base after a delete, and they still win. |
| `pinned`        | `IdList` → nodes, unique                         |      | ✔       | Per view (clarification Q2).                                                                                                                                                                      |
| `collapsed`     | `IdList` → groups, unique                        |      | ✔       | Per view (§g-22). Written with the untracked origin (R5).                                                                                                                                         |

**Rules:**

- An empty list is stored as absent, which keeps round-trips canonical.
- Key order is canonical from the schema.
- No field copies component data. A view only references ids.

### Yjs mirror (ADR 0005, amended by ADR 0012)

```
doc.getArray('views')  Y.Array<Y.Map>
  view: Y.Map { id, type, title, subtitleField?, feature?,
                includes?: Y.Array<Id>, excludeGroups?: Y.Array<Id>, excludeKinds?: Y.Array<string>,
                excludeTags?: Y.Array<string>, dimKinds?: Y.Array<string>,
                positions?: Y.Map<nodeId, Y.Map{x,y}>, pinned?: Y.Array<Id>, collapsed?: Y.Array<Id> }
```

### Reference cleanup (cascade, same transaction)

| Removed | Views change                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| node    | id leaves `includes` and `pinned`, and its `positions` key is deleted (the first two exist today, `pinned` is new) |
| group   | id leaves `excludeGroups` and `collapsed` **(new)**                                                                |
| feature | `feature` is deleted (existing)                                                                                    |
| view    | nothing references views, except stickies anchored to a view (existing 009 rule: they're kept and reported broken) |

`checkIntegrity` reports dangling ids in every list above.

### Lifecycle of the stored view list

```
 no stored views ──first view change──▶ [system, feature, infra] (untracked, never undone) ──▶ the change (tracked unless a collapse)
 stored list ──add / rename / settings / move / pin / tidy / collapse / delete (never the last)──▶ stored list
```

## 2. UI state (`apps/app/src/state/ui-store.ts`)

| Field / action                                                              | Type                                                     | Notes                                                                                                   |
| --------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `currentViewId`                                                             | `Id \| null`                                             | null means the first resolved view. Reset by `resetForDeck`. Never persisted (FR-005).                  |
| `revealed`                                                                  | `ReadonlySet<Id>`                                        | Nodes created here while hidden by the view's filters. Cleared on switch.                               |
| `switchView(id)`                                                            | action                                                   | Sets the id and clears `selection`, `drill`, `focusMode` and `revealed`. The caller fits and announces. |
| `layoutRun`                                                                 | `{ status: 'idle' \| 'running' \| 'slow'; viewId?: Id }` | `slow` after 500 ms shows the progress bar and Cancel.                                                  |
| ~~`collapsed`~~, ~~`setCollapsed`~~, ~~`toggleCollapsed`~~, ~~`expandAll`~~ | removed                                                  | Now read from the current view (`useCollapsed`) and written with `setCollapsed` (R6).                   |

`pruneView` keeps pruning `drill`. Collapse entries for deleted groups are now removed by the model cascade.

## 3. Derived models (pure, never stored)

| Name                             | Where                                | Shape                                                                                                            |
| -------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `resolveViews(file)`             | `packages/model/src/views.ts`        | `View[]`: stored views, or `VIEW_PRESETS`                                                                        |
| `baseViewId(views)`              | model                                | the first view's id                                                                                              |
| `viewPosition(file, view, id)`   | model (`geometry.ts`)                | `Point \| undefined`: the view's own override (any view, base included), else `node.position`                    |
| `ViewFilterResult`               | `apps/app/src/editor/view-filter.ts` | `{ hidden: ReadonlySet<Id>; dimmed: ReadonlySet<Id> }`                                                           |
| `flowCountByNode(deck)`          | app, memoized per deck               | `ReadonlyMap<Id, number>`: flows with at least one step touching the node                                        |
| `ViewRender`                     | `deck-to-flow.ts` input              | `{ position(node, index): Point; subtitle(node): string \| undefined; dimmed; pinned }`                          |
| `LayoutRequest` / `LayoutResult` | `apps/app/src/layout/elk-layout.ts`  | nodes `{id,width,height,parent?}`, groups `{id,parent?}`, edges, `pinned: Record<Id,Point>` → `Record<Id,Point>` |
| `UndoViewContext`                | `editor/views/undo-context.ts`       | `{ viewId, action: 'move' \| 'pin' \| 'rename' \| 'view settings' \| 'change' } \| null`                         |

## Validation rules (from the requirements)

- A view title must be non-empty after trim (FR-041). The model op throws `invalid`, and the UI keeps the old title.
- `removeView` of the last view throws `invalid` (FR-042).
- Every id list is unique, and every id must reference an existing object of the right collection (FR-061). Ops validate before writing and throw `missing-reference`.
- `excludeKinds` and `dimKinds` accept only `NodeKind` values. `excludeTags` accepts any `Text`.
- `moveInView` skips ids that no longer exist (they could be deleted mid-layout), and on the base view it writes `node.position` and deletes that view's own `positions` entry for the node.
- Tidy layout never changes the position of an id in `pinned` (SC-001).
