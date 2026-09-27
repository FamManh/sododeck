# Data Model: Sticky Notes and Command Palette (009)

What is stored in the deck (document), what is derived, and what is UI-only state. The decisions behind each item are in [research.md](research.md).

## Document: `Sticky` (schema v1, additive change)

| Field         | Type                                             | Stored when         | Meaning                                                                                                                         |
| ------------- | ------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | Id                                               | always              | Stable. Prefix `sticky`. Never changes.                                                                                         |
| `text`        | string (markdown)                                | always              | Note text. A committed note is never empty or whitespace-only (the app removes empty drafts, R5); a file may still contain one. |
| `color`       | `amber` \| `blue` \| `green` \| `clay` \| `grey` | optional (existing) | Absent means `amber`. Shown as a tint (R4). There is no picker in 009.                                                          |
| `anchor`      | Id                                               | optional (existing) | The object the note is pinned to. In the UI, only nodes can be picked.                                                          |
| `position`    | `{ x, y }`                                       | optional (existing) | Absolute canvas point when free. Offset from the anchor's canvas position when anchored.                                        |
| `collapsed`   | boolean                                          | **new**, optional   | `true` means shown as one line. The app writes `true` or removes the key (R1).                                                  |
| `showInFlows` | boolean                                          | **new**, optional   | `true` means not dimmed during flow playback. The app writes `true` or removes the key. It is used by the post-007 dimming.     |

**Validation** (JSON Schema plus semantic rules; unchanged except for the two new fields):

- `anchor` or `position` must be present (the existing `anyOf`, rule S2).
- `collapsed` and `showInFlows` must be booleans when present. Invalid fixtures cover a string and a number.
- `additionalProperties: false` still holds.
- The declaration order is `id, text, color, anchor, position, collapsed, showInFlows`. The key-order test depends on it.

**Integrity** (`checkIntegrity`, unchanged): an anchor that names no object is `missing-reference`; one that names several objects is `ambiguous-anchor`.

### States and transitions of a note

```text
            pin(node)                        node deleted (R2)
   free ─────────────▶ pinned ──────────────────────────────▶ free (at same screen point)
    ▲                    │  unpin (same screen point)
    └────────────────────┘

   foreign (anchor = non-node object) ── unpin ──▶ free
   missing (anchor names nothing)     ── unpin ──▶ free
   draft (created, text empty, gesture open) ── blur with text ──▶ free | pinned
                                             ── blur empty ──────▶ (gone, no undo entry)
```

- `expanded ⇄ collapsed` is independent of the anchor state.
- `showInFlows` on / off is independent too.
- Every transition except the draft is one undo step. Deleting a node together with its notes being freed is one undo step.

### Cascade change (amends ADR 0005 for node anchors; ADR 0010)

`removeNode(id)` also does, for each sticky `s` with `s.anchor === id`:

1. `s.position = nodeCanvasPosition(file, id) + (s.position ?? STICKY_DEFAULT_OFFSET)`.
2. Delete `s.anchor`.

Both happen in the same transaction. `RemovalResult.freed` lists those sticky ids, and they are **not** in `broken`. Stickies anchored to deleted edges, flows or steps are unchanged and still reported in `broken`.

## Derived (never stored)

- **Sticky placement** (`stickyCanvasPosition`): `{ point, pinnedTo, status: free | pinned | foreign | missing }` (research R3). `STICKY_DEFAULT_OFFSET = { x: 24, y: -96 }`.
- **Node canvas position** (`nodeCanvasPosition`): the node's `position`, or grid slot `index` (`NODE_GRID`), moved from `canvas-geometry.ts` so the model and the canvas agree.
- **Sticky label**: the first non-empty line of `text`, with markdown markers removed, or "Empty note". Used for the outline, the inspector heading, the collapsed line, the accessible name and palette titles.
- **Search index** (`SearchIndex`): one `SearchEntry` per node, edge, flow, step, rule and sticky:

  | Kind     | Title                     | Context line                  | Body fields                                           |
  | -------- | ------------------------- | ----------------------------- | ----------------------------------------------------- |
  | `node`   | title                     | "<Kind> · <group title>"      | description                                           |
  | `edge`   | label, or "<from> → <to>" | "Connection · <from> → <to>"  | description                                           |
  | `flow`   | title                     | "Flow · n steps"              | description                                           |
  | `step`   | title, or "<from> → <to>" | "Step <n> · <flow title>"     | description, condition, notes                         |
  | `rule`   | title                     | "Rule · <hit policy>"         | description, column names, cells (inputs and outputs) |
  | `sticky` | label                     | "Note · pinned to X" / "Note" | text (the label line counts as the title)             |

  Each field keeps `raw` (for the snippet) and `norm` (normalized, R8). Entries are cached per snapshot object.

- **Search result** (`SearchResult`):
  - `{ kind, id, flowId?, title, context, match: 'title' | 'body', snippet?: { text, ranges }, titleRanges }`
  - Commands are added by the app as `{ kind: 'command', id, title, shortcut? }`.
- **Deck commands**: built in the app from the current capabilities (R10). `available()` hides Focus mode until 010.

## UI-only state (`useUiStore`, never exported)

| Key                  | Shape                                                 | Notes                                                                                              |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `selection.stickies` | `Id[]`                                                | Added to `Selection { nodes, edges }`. Pruned when notes disappear. Cleared by `resetForDeck`.     |
| `stickyEditing`      | `Id \| null`                                          | The note in in-card edit mode. At most one.                                                        |
| `stickyDraft`        | `Id \| null`                                          | The note created by drop or N whose draft gesture is open (R5). Ended on blur, Esc or deck switch. |
| `canvasPointer`      | `{ x, y } \| null` (flow coordinates)                 | Last pointer point over the pane, for N.                                                           |
| `palette`            | `{ open: boolean; returnFocus: HTMLElement \| null }` | ⌘K state. The query and highlighted row are component state inside the dialog (reset on open).     |

**Deferred (post-007)**: `notesDisplay: 'dimmed' | 'shown' | 'hidden'`, a device preference (localStorage), default `dimmed`.
