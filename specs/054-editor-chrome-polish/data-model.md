# Data Model: Editor chrome polish

No change to the deck file format, the schema or the Yjs document.

## Built-in view presets (constants, `packages/model/src/views.ts`)

| id          | type      | title (was)           | subtitleField | notes                           |
| ----------- | --------- | --------------------- | ------------- | ------------------------------- |
| `system`    | `system`  | **Overview** (System) | `tech`        | base view, shown first          |
| `feature`   | `feature` | **Flows** (Feature)   | `flows`       | "n flows · owner" subtitle      |
| ~~`infra`~~ |           | removed from presets  |               | stored Infra views keep working |

Rules: presets are shown while `views` is empty and written on the first view change (unchanged);
stored views are never rewritten; custom views keep `CUSTOM_VIEW_DEFAULTS`.

## Derived: group lock state (UI helper, not stored)

`groupLockState(deck, groupId)` → `'locked' | 'unlocked' | 'empty'`

- members = every card whose `group` is the group or one of its descendants (`group.parent` chain).
- `locked`: members.length > 0 and every member `locked === true`. `empty`: no members.
- A selection's lockable cards = selected cards ∪ members of selected groups. Connectors and
  stickies are not lockable in this feature.
- The lock action reads Unlock iff lockable cards is non-empty and all are locked.

## UI state (not document data)

| Name                    | Where                                                 | Shape                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `codeDrawer`            | Zustand `ui-store`, persisted in `sododeck.jsonPanel` | `{ open: boolean; width: number; format: 'dbml' \| 'sql' }`, width clamped 320…max by `clampCodeDrawerWidth(width, viewport, detailsWidth \| null, compact)` |
| `jsonPanel.format`      | prefs                                                 | now only `'json'`; stored `'dbml'`/`'sql'` read as `'json'`                                                                                                  |
| `jsonPanel.schemaScope` | prefs                                                 | kept, ignored while hidden, never rewritten                                                                                                                  |
| `focusMode`, `drawer`   | existing                                              | unchanged                                                                                                                                                    |

## Validation

- Prefs reader: invalid or missing code-drawer fields fall back to `{ open: false, width: 560, format: 'dbml' }`; width is a finite number.
- `clampCodeDrawerWidth` is pure and monotonic: result ∈ [320, max]; max ≥ 320 even in tiny windows (then the caller closes the other drawer).
