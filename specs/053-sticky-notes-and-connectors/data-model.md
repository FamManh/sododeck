# Data Model: Sticky notes and connector multi-select

All changes are additive optional fields in `.sododeck.json` v1 (no version bump). Property order in
`v1.json` is the written key order; new properties are appended in the order below.

## Sticky (existing, extended)

| Field                                            | Type                                   | Meaning                                                       |
| ------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------- |
| `id`                                             | Id                                     | stable (unchanged)                                            |
| `text`                                           | string                                 | markdown (unchanged)                                          |
| `color`                                          | StickyColor                            | amber, blue, green, clay, grey; absent = amber (unchanged)    |
| `anchor`, `position`, `collapsed`, `showInFlows` | unchanged                              |                                                               |
| `size` (new)                                     | Size `{ w, h }`                        | note box; absent = default 200 × 200; ignored while collapsed |
| `fontSize` (new)                                 | integer, one of 12, 14, 16, 20, 24, 32 | fixed text size; absent = Auto                                |
| `align` (new)                                    | `left                                  | center                                                        | right` | text alignment; absent = centre |
| `tags` (new)                                     | Tags (≤ 10, case-kept)                 | deck tags; colours from root `tagColors`                      |
| `locked` (new)                                   | `true`                                 | cannot be moved, resized, deleted; absent = unlocked          |

Rules: minimum size 96 × 96 (values below are clamped on write, accepted on read); `size` positive
numbers only; `tags` follow 033 (case kept, case-insensitive uniqueness, first spelling wins).

## Edge (existing, extended)

| Field          | Change                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------- |
| `from`, `to`   | may now name a **sticky** id as well as a node or group id (still `Id`)                  |
| `locked` (new) | `true`; cannot be reshaped, reconnected, deleted; style stays editable only after unlock |

Semantic rules: S-rule for edge ends accepts nodes | groups | stickies; a node, group and sticky must
not share an id when an edge end names it (`duplicate-id`, as ADR 0031 for groups); a connector whose
two ends are the same id is refused (self).

## Relationships and lifecycle

- Sticky → connector: a sticky may be the end of any number of connectors. Deleting a sticky deletes
  those connectors in the same transaction and undo step (listed by the delete confirmation).
  Deleting a node or group still frees pinned stickies (unchanged).
- Sticky pin (`anchor`) and connector are independent (spec FR-013).
- Steps never reference a connector with a sticky end (flow analysis ignores them).
- Tag rename, recolour and delete are deck-wide and now reach stickies in the same undo step.

## Derived (not stored)

- Fitted font size (from text, size, tag rows, align).
- Tag chip rows and "+N" collapse.
- Sticky box used for routing: `stickyBox(sticky, position)`; collapsed = one-line height.

## UI-only state (Zustand, not document data)

- `lastStickyColour`: colour used for the next new note and for the pad tile.
- Open toolbar popover and sticky resize-in-progress.

## Validation summary

| Where                     | Check                                                                          |
| ------------------------- | ------------------------------------------------------------------------------ |
| Schema (Ajv + Zod parity) | field types, `fontSize` enum, `align` enum, `locked` const true, size positive |
| Model write               | refs accept the three collections; locked objects refuse writes; clamp size    |
| Integrity on load         | sticky as end exists; id collision flagged; unknown optional data preserved    |
