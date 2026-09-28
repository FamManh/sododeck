# Data Model: Card Quick Edit (019)

**No document or file-format change.** Every edit writes existing fields through `DeckEditor`:

- node `title`, `type`, `owner`, `tags`, `tech`, `links`, `rules`
- edge `label`, `protocol`, `direction`
- group `title`
- the node array order (Arrange)
- removing a group
- view pins

All the new state below is UI-only, in the Zustand UI store (`apps/app/src/state/ui-store.ts`). It never enters Yjs, the `.sododeck.json` file or undo history (FR-047, FR-048).

## UI store additions

| Field           | Type                                                                                                                                           | Default | Meaning                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `titleEdit`     | `{ target: 'node' \| 'group'; id: Id; isNew: boolean; kind?: NodeKind } \| null`                                                               | `null`  | The object whose title is being edited in place (R2, R3)                                                   |
| `contextMenu`   | `{ target: MenuTarget; point: { x: number; y: number }; via: 'pointer' \| 'keyboard' \| 'toolbar'; returnFocus: HTMLElement \| null } \| null` | `null`  | The open canvas menu (R7)                                                                                  |
| `toolbarField`  | `ToolbarFieldId \| null`                                                                                                                       | `null`  | Which toolbar popover is open (`kind`, `owner`, `tags`, `tech`, `links`, `rules`, `protocol`, `direction`) |
| `canvasGesture` | `'pan' \| 'drag' \| null`                                                                                                                      | `null`  | A pointer gesture in progress; the toolbar hides while it is set (R5)                                      |

`MenuTarget` = `{ kind: 'component' | 'components' | 'connection' | 'group' | 'sticky' | 'mixed'; ids: Selection } | { kind: 'canvas' }`. `sticky` is a menu target only; the toolbar variant for stickies is `none`.

### Actions

- `startTitleEdit(edit)`:
  - It is refused in flow mode, during a session and in view-only mode.
  - It sets `titleEdit`.
  - It closes `contextMenu` and `toolbarField`.
- `endTitleEdit()` sets `titleEdit` to `null`. The caller has already committed or cancelled.
- `openContextMenu(menu)` / `closeContextMenu()`.
- `openToolbarField(id)` / `closeToolbarField()`.
- `setCanvasGesture(g)`:
  - Setting a gesture closes `toolbarField`.
  - It does not touch `contextMenu`, because Radix closes the menu on an outside pointer.
- `pruneSelection` (existing) also clears `titleEdit` and `contextMenu` when their target no longer exists.
- `resetForDeck` clears all four fields.

### Transitions

```text
titleEdit:   null ──(dbl-click | F2 | Rename | add component)──▶ editing
             editing ──Enter / blur / selection change──▶ commit → null
             editing ──Esc──▶ null (no write)
             editing ──Tab / ⇧Tab──▶ commit → editing(next / previous component)
             editing(isNew) ──⌘⏎──▶ commit → add same kind → editing(new, isNew)
             editing ──target removed──▶ null (no write)

toolbar visible  ⇔ selection ≠ ∅ ∧ variant ≠ none ∧ canvasGesture = null ∧ titleEdit = null
                   ∧ ¬flowMode ∧ ¬session ∧ ¬viewOnly ∧ ¬hideUi
```

## Action (not stored; code objects in `editor/actions/`)

| Field                 | Type                                                                 | Rule                                                                |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `id`                  | `string` (e.g. `title.rename`)                                       | Unique across the list (unit test)                                  |
| `label`               | `string \| (ctx) => string`                                          | For example "Pin", "Unpin" or "Pin all" from the context            |
| `icon`                | lucide icon, optional                                                |                                                                     |
| `shortcut`            | `ShortcutId`, optional                                               | Must exist in `SHORTCUTS` (unit test)                               |
| `section`             | `'open' \| 'edit' \| 'clipboard' \| 'arrange' \| 'view' \| 'danger'` | Menu sections in this order                                         |
| `surfaces`            | `('menu' \| 'toolbar')[]`                                            |                                                                     |
| `targets`             | `MenuTarget['kind'][]`                                               |                                                                     |
| `modes`               | `('edit' \| 'flow' \| 'session' \| 'viewOnly')[]`                    | Default `['edit']`; Open details, Copy JSON and Fit add the others  |
| `applies(ctx)`        | `boolean`, optional                                                  | Extra conditions (e.g. has children, a view is active)              |
| `disabledReason(ctx)` | `string \| null`, optional                                           | Shown as a tooltip; the item stays visible but disabled             |
| `children(ctx)`       | `Action[]`, optional                                                 | Submenu (Arrange, Add component, Protocol, Direction)               |
| `run(ctx)`            | `void`                                                               | Every document write is exactly one undo step (`oneStep` / `batch`) |

`ActionContext` = `{ editor, deck (snapshot), selection, target: MenuTarget, mode, point?, viewId, ui }`. It is built by `useActionContext()` and passed to the pure functions.

**Pure functions** (unit-tested):

- `actionsFor(ctx, surface) → Section[]`
- `toolbarVariant(selection, deck) → Variant`
- `toolbarPlacement(rect, size, viewport, insets) → { x, y, side }`
- `nextTitleTarget(deck, visible, id, dir) → Id | null`
- `arrangeOrder(nodes, ids, 'front' | 'back') → Id[]`
- `choiceState(shared, options) → ChoiceOption[]`

## Derived values (not stored)

- **Shared field values** for a multi-selection come from the existing `bulkView(nodes)` (`inspector/derive.ts`, `Shared<T>`). They are `{ kind: 'same', value } | { kind: 'mixed' }`, and tags come with per-tag counts.
- **Owner and tech options** are the distinct values in the deck (sorted, case-insensitive), plus the typed text.
- **Toolbar placement** is recomputed on selection change, on `onMoveEnd` and on `onNodeDragStop`.

## Validation rules

- **Title:** trimmed. Empty or unchanged → no write (FR-005). A new component's empty title stays "Untitled <kind>" (FR-014). Titles are never used for ids (Principle III).
- **Arrange:** only moves node positions within the `nodes` array. Relative order among the moved ids is kept, and one `batch` makes it one undo step.
- **Ungroup / Delete group:** `remove('groups', id)`. Members and child groups move to the parent (002 cascade), in one undo step.
- **Field writes** use the same value rules as the drawer (008). For example, `null` clears an optional field, and tags are deduplicated case-insensitively.
