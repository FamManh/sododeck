# Contract: `@sododeck/model` after 036

The stored layout is in [data-model.md](../data-model.md). This file states what callers can rely
on.

## Unchanged (every signature and behaviour)

- `createDeck`, `fromJSON`, `toJSON`, `serializeDeck`, `getObject`, `getRule`.
- `createEditor(doc, options)` and every `DeckEditor` method: same arguments, same return values,
  same errors (`invalid`, `not-found`, `missing-reference`, `duplicate-id`), same validation
  before writing, same undo grouping (keys, gestures, sticky draft, untracked origin), same delete
  cascade and `RemovalResult`.
- `observeDeck` → `DeckChange`: one per transaction; `origin` `local` / `undo` / `redo` /
  `remote`; `changes` with `scope`, `id`, `child`, `kind` and sorted `keys`; a reorder is
  `updated` with empty `keys`; changes sorted by scope.
- `createDeckSnapshot`: equals `toJSON(doc)` (key order included) after every transaction;
  untouched objects and collections keep their identity.
- `previewRemoval`, `removeTarget`, `serializeEntry` / `serializeEntries`, `analyzeFlow`,
  `checkIntegrity`, `checkDeck`, `captureFlowStructure` / `flowStructureChanged`, fragments,
  geometry, views, search, rule evaluation.
- Index arguments (`reorder`, `moveStep`, `addStep`, `addRuleColumn`, `addRuleRow`, `moveRuleRow`,
  `moveRuleColumn`) mean a position in the list as read (sorted), clamped as before.

## New guarantees

For two documents that start equal, are edited separately through editors, and then exchange
their updates in any order:

1. **Convergence.** Both read as equal decks, with every list in the same order.
2. **Move keeps edits.** A `reorder` / `moveStep` / `moveRuleRow` / `moveRuleColumn` on one side
   and any field edit of the same item on the other both survive.
3. **Move never duplicates.** The same item moved on both sides exists once.
4. **Inserts both survive.** Items inserted at the same position on both sides all exist; their
   relative order is the same on both sides. A later insert between two of them lands between
   them.
5. **Delete wins.** An item deleted on one side and edited or moved on the other is gone, whole.
6. **Rule tables stay rectangular.** Whatever columns and rows were added, moved or removed on
   either side, every row reads with exactly one cell per column.
7. **Long text merges.** For the fields in data-model "Long text", characters inserted on both
   sides are all present; a clear on one side removes only the characters that existed when it
   ran.
8. **Short text and other scalars**: the later write wins per field; other fields are untouched.
9. **Lookups** by id do not depend on list size.

## Additions

```ts
/** True when `doc` holds a deck in the layout used before 036 (cannot be read by this build). */
export function isLegacyLayout(doc: DeckDoc): boolean;

export interface EditorOptions {
  captureTimeout?: number;
  newId?: (prefix: string) => Id;
  /**
   * Repair view entries that name nothing after a change that is not this editor's own
   * (default `true`). Runs with the untracked origin: saved and synced, never an undo step.
   */
  repair?: boolean;
}
```

- `toJSON`, `createDeckSnapshot` and `createEditor` must not be called on a legacy document;
  callers that build a document from stored bytes check `isLegacyLayout` first.
- Nothing else is exported. `Y.Text`, order keys and `$…` keys never appear in a value the
  package returns.

## Reading rules callers may notice

- A long text field written as `''` through `update` / `updateStep` / `updateRule` /
  `updateBranch` / `updateMeta` reads back as `''`; cleared with `null`, it reads back absent (as
  today).
- A `style` with no keys never appears in a read value.
- `rules` in `toJSON` output is in rule order (creation order for one client), the same on every
  client.

## App contract (`apps/app`)

- `useLiveField` (text fields, note text): while a field has focus, a change to its value from
  outside is merged into the draft; typed characters are kept and the caret stays with them
  (FR-016). No API change for callers.
- `deckLoader` result gains `{ kind: 'unsupported' }`; the editor page shows the not-found page
  with the legacy sentence.
- `LibraryOpErrorCode` gains `'unsupported-deck'`; library export, rename and duplicate of a
  legacy deck show that error and write nothing.
