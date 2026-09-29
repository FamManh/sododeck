# Data Model: Canvas Editing (016)

## Document (file format, additive in schema v1)

### `$defs/Size` (new)

| Field    | Type   | Rules                      |
| -------- | ------ | -------------------------- |
| `width`  | number | required, `> 0`, canvas px |
| `height` | number | required, `> 0`, canvas px |

`additionalProperties: false`. 017 reuses this definition for `node.size`.

### `$defs/Frame` (new)

| Field      | Type       | Rules                                  |
| ---------- | ---------- | -------------------------------------- |
| `position` | `Position` | required; top-left corner of the frame |
| `size`     | `Size`     | required                               |

### `Group` (changed)

| Field         | Type       | Rules                                                |
| ------------- | ---------- | ---------------------------------------------------- |
| `id`          | `Id`       | unchanged                                            |
| `title`       | `Text`     | unchanged                                            |
| `description` | string     | unchanged                                            |
| `parent`      | `Id`       | unchanged; enclosing group                           |
| `position`    | `Position` | **new, optional**; frame top-left on the base canvas |
| `size`        | `Size`     | **new, optional**; frame size on the base canvas     |

The description changes to: "A named frame that holds nodes and nested groups. Membership is
stored on the members (`node.group`, `group.parent`). `position` and `size` place the frame.
Older files may omit them, and the app then fits a frame around the members."

### `View` (changed)

| Field         | Type                     | Rules                                                                    |
| ------------- | ------------------------ | ------------------------------------------------------------------------ |
| `positions`   | `{ [nodeId]: Position }` | unchanged                                                                |
| `groupFrames` | `{ [groupId]: Frame }`   | **new, optional**; frames for this view; keys MUST be existing group ids |

### Semantic rules (new, `packages/schema/src/semantic-rules.ts`)

- **S-frame-pair**: a group has both `position` and `size`, or neither.
- **S-group-frames-keys**: every `view.groupFrames` key is the id of a group in the file.

### Yjs layout

`group.position` and `group.size` are nested `Y.Map`s, the same as `node.position`.
`view.groupFrames` is a `Y.Map` from group id to a `Y.Map{ position: Y.Map, size: Y.Map }`.
`toY` / `fromY` handle both with no special case (`packages/model/src/convert.ts`).

### Resolution: which frame is drawn

1. In the base view (`views[0]`), or when there are no views, use `group.position` + `group.size`.
2. In any other view, use `view.groupFrames[id]` if present, otherwise the base frame.
3. With no stored frame at all (an older tab has not fitted it yet), fall back to the derived box (today's `groupBounds`).

`viewDeck` projects step 2 onto the group, so `groupBounds` applies steps 1 and 3 (research R3).

### Invariants

- Membership never follows geometry. Only these change `node.group` / `group.parent`:
  - drop (FR-018–FR-020)
  - paste (FR-008)
  - `groupSelection`
  - ungroup / remove
  - the existing group field
- A frame is never smaller than its members' box plus `GROUP_PADDING` (24) and never smaller than 160 × 96. The resize UI enforces this. Files may break it (a member drawn outside); loading still accepts them.
- Removing a group deletes `view.groupFrames[id]` in every view (the cascade).

## Model API (`packages/model`, new or changed)

| Member                                                            | Kind   | Undo                                  | Notes                                                                                                     |
| ----------------------------------------------------------------- | ------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `fitGroupFrames(json, { cardSize, padding, viewId? })`            | pure   | —                                     | Returns `Map<groupId, Frame>` for groups missing a frame (base, or the view's positions). Inner-first.    |
| `editor.fillGroupFrames(base, perView)`                           | op     | untracked                             | Writes only missing frames. Used after open.                                                              |
| `editor.setGroupFrames(viewId, frames)`                           | op     | tracked, key `views:<id>:groupFrames` | Writes the group fields on the base view, and materializes then writes `view.groupFrames` on other views. |
| `editor.groupSelection({ nodes, groups, title, parent, frames })` | op     | tracked, one step                     | Returns the new group id.                                                                                 |
| `toFragment(json, { nodes, groups })`                             | pure   | —                                     | Returns a `Fragment` envelope.                                                                            |
| `parseFragment(text)`                                             | pure   | —                                     | Returns `Fragment` or `null`.                                                                             |
| `serializeFragment(fragment)`                                     | pure   | —                                     | Returns text for the clipboard.                                                                           |
| `editor.pasteFragment(fragment, { offset, parent, viewId })`      | op     | tracked, one step                     | New ids; remaps references; drops unknown rule ids. Returns `{ nodes, edges, groups }` new ids.           |
| `editor.cancelGesture()`                                          | op     | removes the open step                 | Ends the gesture, undoes it, and drops it from the redo stack.                                            |
| `materialize()` (internal)                                        | change | untracked                             | Also copies base frames into `view.groupFrames`.                                                          |
| cascade on group removal                                          | change | same step                             | Also deletes `view.groupFrames[id]`.                                                                      |

### `Fragment`

```ts
interface Fragment {
  sododeckFragment: 1;
  deck: SododeckFile; // only nodes, edges, groups; meta.title "Fragment"
}
```

The envelope is validated with `parseSododeckFile` and `checkDuplicateIds`. `origin`, a bounding
box of the copied objects, is computed on parse and not stored.

## UI state (`apps/app/src/state/ui-store.ts`, never saved or undone)

| Field           | Type                                                                          | Set by                                  | Cleared by                        |
| --------------- | ----------------------------------------------------------------------------- | --------------------------------------- | --------------------------------- |
| `canvasGesture` | `'pan' \| 'drag' \| 'group-drag' \| 'resize' \| 'marquee' \| null` (extended) | move / drag / resize / selection start  | the matching end, Esc             |
| `dropTarget`    | `groupId \| null`                                                             | `onNodeDrag` (pointer in a frame, no ⌥) | drag stop, ⌥ down, pointer leaves |
| `guides`        | `Guide[]`                                                                     | snapping during a drag                  | drag stop, ⌘ down                 |
| `dragReadout`   | `{ dx, dy } \| null`                                                          | group drag                              | drag stop                         |
| `marqueeCount`  | `number \| null`                                                              | marquee in progress                     | marquee end                       |
| `pasteSerial`   | `{ at: Point, count: number }`                                                | each paste                              | pointer moves more than 4 px      |

Other state:

- A local ref in the handlers holds the drag start positions, the snap candidates, the arrow offset and the nudge timer.
- `localStorage['sododeck:fragment-copied']` holds a timestamp only: a hint for the Paste item, never content.

### `Guide`

```ts
interface Guide {
  axis: 'x' | 'y';
  at: number; // canvas px
  from: number;
  to: number; // span across the aligned cards
  distance?: { value: number; at: Point };
  equalGaps?: { value: number; at: Point }[];
}
```

## State transitions

- **Component drag**: idle → `drag`. Each frame applies the snap, arrow offset and ⇧ axis lock, and updates `dropTarget`. On stop: membership changes → `endGesture`, or `cancelGesture` on Esc; with ⌥, restore the originals and `pasteFragment`.
- **Group drag**: idle → `group-drag`, with the subtree start positions recorded. Each frame moves the subtree by the delta and sets `dragReadout`. On stop: nest or un-nest + toast → `endGesture`, or `cancelGesture` on Esc; with ⌥, duplicate.
- **Resize**: idle → `resize`. Each frame clamps to the minimum and applies the ⇧ / ⌥ modes. On stop: `setGroupFrames` → `endGesture`, or `cancelGesture` on Esc.
- **Nudge burst**: idle → open (`beginGesture`). Each nudge moves the selection and resets the 1 s timer. On timeout, any other key or pointer down: `endGesture`.
- **Marquee**: idle → `marquee`, with the prior selection saved. ⌥ toggles Partial / Full. On end the selection is applied; on Esc the prior selection is restored.
