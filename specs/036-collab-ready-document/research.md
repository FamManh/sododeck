# Research: Collaboration-Ready Deck Document (036)

Decisions behind [plan.md](plan.md). Each entry: the decision, why, and what was rejected. Checked
against the code on `main` (`f2b0140`): `packages/model/src/` (5.8k lines, every op read), the app's
storage providers and the text fields.

## R1. Where the change lives

**Decision:** almost all of it is in `packages/model`. The public API (`DeckEditor`, `toJSON`,
`fromJSON`, `observeDeck` / `DeckChange`, `createDeckSnapshot`, `checkIntegrity`, `checkDeck`)
keeps its signatures and contracts. The app changes in three places only: the text-field hook
(R7), the two places that build a document from stored bytes (R10), and two tests that reach into
the Yjs layout.

**Why:** the app never touches the Yjs layout outside tests (checked: no `getArray` / `getMap` /
`Y.Map` use in `apps/app/src` outside `*.test.*`; storage only moves opaque update bytes). The
model's 491 tests and the app's 1,776 tests are written against the public API, so they are the
regression suite for "nothing changed" (spec US1, SC-002).

## R2. Collections keyed by id

**Decision:** each of `nodes`, `groups`, `edges`, `views`, `features`, `flows`, `stickies` becomes a
root `Y.Map<id, Y.Map>` (same root names). The object map does **not** hold `id`; the key is the
id. A flow's `steps` and `branches`, and a rule's `inputs`, `outputs` and `rows`, are `Y.Map<id,
Y.Map>` inside their owner, always present (created with the owner).

**Why:** lookup is `map.get(id)` (FR-012). A delete removes the key, and with it everything a
concurrent client wrote inside (FR-010). Two clients writing the same fixed id (the three view
presets, `system` / `feature` / `infra`) converge on one entry instead of duplicating it. `rules`
is already keyed by id; its entries gain an order key so the exported key order is the same on
every client.
`branches` always present removes the race where two clients each create the list for a flow's
first branch and one branch is lost.

**Rejected:**

- _Keep `Y.Array` and add an order field._ Lookups stay linear, and a move is still delete +
  insert.
- _A separate `Y.Map<id, order>` per list._ A move that races a delete leaves an orphan order
  entry that needs cleaning; with the order inside the item, the delete simply wins.
- _Keep `id` inside the map as well._ Two sources of truth for identity.

## R3. Order keys

**Decision:** every list item carries `$order`, a base-62 fractional-index string compared by
code unit. New module `order-key.ts` (`keyBetween(a, b)`, `keysBetween(a, b, n)`), an own
implementation of the well-known variable-length-integer scheme (the public-domain algorithm
behind `fractional-indexing`), about 120 lines, property-tested. Lists are read sorted by
`($order, id)`.

- `fromJSON` assigns `keysBetween(null, null, n)` in file order: short keys (`a0`, `a1`, …).
- Append = `keyBetween(last, null)`; insert at an index = `keyBetween(prev, next)`; move = one
  `set('$order', …)` on the moved item (FR-007).
- **Ties** (two clients generate the same key, e.g. both append): the id breaks the tie, the same
  on every client, with no write (FR-009, FR-021). When a later local insert lands between two
  tied items, the insert re-keys the tied run after the insertion point in the same transaction,
  so "between them" is honoured.
- A missing or malformed `$order` sorts as `''`; an op that cannot compute a key between its
  neighbours re-keys the whole list (a local, tracked write). Not expected; it keeps a damaged
  list editable.
- The index-based public API stays (`reorder(c, id, toIndex)`, `moveStep`, `addStep(index)`,
  `addRuleColumn(index)`, `addRuleRow(index)`, `moveRuleRow`, `moveRuleColumn`): ops translate an
  index to neighbours on the sorted list.

**Why strings, not numbers:** midpoints of floats run out of precision after ~50 inserts at one
spot and then need a renumbering pass that conflicts with concurrent edits.

**Why no dependency:** the algorithm is small and stable; constitution VIII prefers no new runtime
dependency.

**Sorting cost:** `toJSON` sorts each list once. The snapshot re-sorts a list only when a
transaction added, removed or re-ordered one of its items (R6); a field edit reuses the previous
order. A move needs the sorted list once: about 1–2 ms at 10,000 items (SC-005 budget 10 ms).

## R4. Flow steps keep one flat order

**Decision:** a flow's steps share one order space, exactly as today's single array. The exported
order is the stored order. No "main path first" normalization on read.

**Why:** files whose steps are not in normal order are valid and round-trip today
(`moveStep` already tolerates them). Normalizing on read would change their export and break
FR-001. `analyzeFlow` partitions steps by path with a filter, so an interleaved order produced by
concurrent edits (one client appends a main step while another splits the tail into branch "a")
does not affect numbering, playback or problems. Single-client ops keep the normal order as before
(`appendIndex`, `moveStep`'s checks, `addBranch`'s split are unchanged in meaning; they compute
keys instead of indexes). Spec FR-011 was reworded to say this.

## R5. Rule cells keyed by column

**Decision:** a rule row stores `cells: Y.Map<columnId, string>` (always present) instead of the
positional `when` / `then` arrays. On read, `when = inputs.map(c => cells.get(c.id) ?? '')` and
`then` likewise, so the file is unchanged and schema rule S1 (one cell per column) holds by
construction.

**Why:** with positional arrays, one client adding a column while another adds a row leaves a row
with too few cells: an invalid file that cannot be re-imported. Keyed cells also make
`moveRuleColumn` a single order change (no shuffling of every row), and `setRuleCell` a single
map set (two clients editing different cells of one row both keep their edit; today the cell is
delete + insert in an array).

## R6. Change observation and the snapshot

**Decision:** `observe.ts` is rewritten for map roots; the `DeckChange` contract is unchanged
(`scope`, `id`, `child`, `kind`, sorted `keys`; a reorder is `updated` with no keys). Internal keys
(`$…`) are never reported in `keys`. Ids come from the event path and `changes.keys`, so the
private-API reads of deleted items (`_map`, `_start`) go away. `snapshot.ts` reads objects through
the new reader (R8) and re-sorts a list only when a change in it is `added`, `removed`, or
`updated` with no keys.

**Why:** every surface consumes `DeckChange` and the snapshot; keeping their contracts is what
keeps the app unchanged.

## R7. Long text as `Y.Text`

**Decision:**

- **Fields** (`text-fields.ts`, one table): `description` on the deck (meta), node, group, edge,
  feature, flow, step, branch and rule; step `notes` and `payload`; sticky `text`. A schema test
  asserts the table covers every field `v1.json` describes as markdown.
- **Always present:** the `Y.Text` is created with its object (empty when the field is absent), so
  two clients who start the first text of a field at once type into the same `Y.Text` (spec edge
  case). Writers still create one if it is missing.
- **Presence in the file:** non-empty → emitted. Empty → absent, except when the object carries
  the marker `$blank:<field>` (set only when a file or an API call gave an explicitly empty
  string), which emits `""`. This keeps `description: ""` round-tripping (FR-002) while a cleared
  field stays absent (FR-001). Sticky `text` is required and always emitted. The same marker
  (`$blank:branches`) keeps a file's explicit `branches: []`.
- **Writes** go through `writeText(ytext, next)`: common prefix and suffix are kept, only the
  middle is deleted and inserted (FR-015), never splitting a surrogate pair. Clearing deletes the
  characters and keeps the `Y.Text`.
- **Reads:** readers get plain strings (FR-018); `Y.Text` never leaves the model.
- **Typing in the app (FR-016):** `useLiveField` keeps a draft while the field has focus and
  writes the whole (trimmed) text. When the document's value changes under a focused field (a
  remote edit), the hook rebases: `draft' = rebase(base, theirs, draft)` and maps the caret
  through the remote splice (pure helper `rebase-draft.ts`, unit-tested). The next write then
  differs from the document only by the local user's characters. The snapshot notifies React
  synchronously (`useSyncExternalStore`), so the rebase runs before the next animation-frame
  write.
- **Undo (FR-017):** unchanged. The field's gesture makes one focus session one step, and the
  `UndoManager` only reverts the local origin's inserts and deletes.

**Rejected:**

- _Create the `Y.Text` on first use._ Simpler, but two people starting a description at the same
  moment each create one and one text is lost: the most likely concurrent-typing case.
- _Delete the key to clear._ A concurrent typer's text would be deleted with it.
- _`Y.Text` for titles._ Letter-merging two renames gives nonsense; last write wins is the better
  behaviour for short fields (spec Assumptions).
- _An editor binding (y-codemirror, y-prosemirror)._ The fields are plain textareas; a binding is
  a dependency and a rewrite of every field.

## R8. One reader, one writer

**Decision:** two small modules replace ad-hoc `fromY(map)` / `toY(object)` on deck objects:

- `read.ts`: `readObject(kind, id, map)`, `readRule(id, map)`, `readMeta(map)`,
  `orderedEntries(listMap)`. Skips `$…` keys, turns `Y.Text` into strings by R7's rule, orders
  children, rebuilds `when` / `then`, and drops an empty `style` (R9).
- `write.ts`: `createObject(kind, plain, order)`, `createRule`, `writeField(map, kind, key, value)`
  (routes long text to `writeText`, keeps nested maps for `position` / `size` as today).

Every op, `toJSON`, the snapshot and `getObject` / `getRule` go through them. `convert.ts`'s
`toY` / `fromY` stay for plain nested values.

**Why:** the layout knowledge (order key, markers, text, children) sits in one place instead of
twenty ops.

## R9. Check and repair on receive

**Findings.** Problems are already derived from the snapshot for every change, whatever its
origin (`problems-store.ts` subscribes to the snapshot), so FR-019 holds today; this feature adds
tests for it. What two valid concurrent edits can leave behind:

| Leftover                                                                                                         | Valid in a file?        | Handling                                                                                              |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Connection, step, note or parent pointing at a deleted object                                                    | yes (integrity problem) | kept, reported (FR-020). Undo of the delete makes it whole.                                           |
| Parent cycle (each makes the other its parent)                                                                   | yes (integrity problem) | kept, reported.                                                                                       |
| Step naming a removed branch; chain break                                                                        | yes (`analyzeFlow`)     | kept, reported.                                                                                       |
| View lists naming a deleted component or group (`includes`, `pinned`, `positions`, `collapsed`, `excludeGroups`) | yes (integrity problem) | **repaired by a write** (below): noise the user should not have to clean by hand.                     |
| `view.groupFrames` key naming a deleted group                                                                    | **no** (rule S5)        | **repaired by the same write**: otherwise the export cannot be re-imported.                           |
| `style` with neither fill nor stroke (each client cleared one)                                                   | **no** (rule S6)        | **dropped on read** (R8): can never have come from a file, so reading it as "no style" loses nothing. |
| Row with a cell for a removed column, or missing one for a new column                                            | n/a                     | by construction (R5).                                                                                 |
| Duplicate id in one list                                                                                         | no                      | impossible by construction (R2).                                                                      |
| Equal order keys                                                                                                 | n/a                     | stable tie-break, no write (R3).                                                                      |
| Sample inputs for a detached rule or removed column                                                              | yes                     | kept (not reported today either); out of scope.                                                       |

**Decision (the one write repair):** `repairViewRefs(doc)` removes, from every stored view, list
entries and map keys that name a component or group that does not exist, and drops a list or map
it empties (as the local cascade does). The editor runs it after a transaction that is not its
own (`remote` in `observeDeck`) **and** that removed a component or group, or added or changed a
view. It writes with the editor's untracked origin: saved and synced, never an undo step
(FR-022). Every client computes the same deletes, deleting twice is harmless in a CRDT, and the
repair's own transaction is local, so it does not trigger another round.

- Loading from storage happens before the editor exists, so opening a deck never repairs: a file
  that arrived with a dangling pin still round-trips and still shows its problem, as today.
- `createEditor(doc, { repair: false })` turns it off (throwaway editors in `previewRemoval` and
  the library worker).

**Rejected:**

- _Delete dangling connections like the local cascade._ The person who drew the connection has
  not agreed to lose it, and the deleter's undo could not bring it back (spec Assumptions).
- _Hide dangling view entries on read instead of writing._ A file that arrives with a dangling
  entry would lose it on export (not byte-identical), and the snapshot would have to rebuild every
  view whenever a component is added or removed.
- _Rename a duplicate id and follow its references_ (the backlog's example): cannot occur inside a
  list any more; across lists it is ambiguous which object a reference meant.

## R10. Decks stored before this feature

**Decision:** no migration and no stored version marker (founder, §g-81 / §g-82). A structural
probe, `isLegacyLayout(doc)`, recognises the old layout: a collection root that holds list items,
a rule whose `inputs` is a `Y.Array`, or a `meta.description` that is a string. It is checked in
the two places that build a document from stored bytes:

- `routes/deck-loader.ts` → new loader result `{ kind: 'unsupported' }`, shown by the existing
  not-found page with its own sentence ("This deck was saved by an earlier development build and
  can't be opened. Import its exported `.sododeck.json` file again.").
- `storage/library-ops.ts` `load()` → `LibraryOpError('unsupported-deck', …)`, so export,
  rename and duplicate from the library fail with a message instead of producing an empty deck.

Nothing stored is changed or deleted.

**Why a probe:** without one, an old deck opens as an **empty** deck (the old list items are
invisible to map reads) and the next edit autosaves over its library summary. A probe costs no
stored field. An old deck with no content at all is indistinguishable from a new empty one, which
is correct to open.

**Rejected:** a `meta.layout` number (the founder ruled out version markers for now; when 025
returns, "absent = 2" works because every deck stored from now on has this layout); a one-off
converter (explicitly not wanted; the JSON export / import path covers the founder's own decks).

## R11. What stays last-write-wins

Recorded in the ADR as known limits, not solved here (out of the backlog's scope, YAGNI):

- **First creation of an optional nested container** on one object by two clients at once
  (`view.positions`, `pinned`, `collapsed`, `tags`, `rules`, `ruleInputs`, `style`, `route`,
  `links`, a node's first `position`): each creates its own container and one wins. Edits to an
  existing container merge key by key, as today.
- **View presets written by two clients at once** (first view edit in each): the fixed ids
  converge on one entry per preset, but the losing client's first edit inside that preset is lost.
- **Short text** (titles, labels, cells): by decision.
- **Plain lists edited as a whole** (`tags`, `links`, filters): replaced as one value.
- **Key order of map-like objects** (`view.positions`, `groupFrames`, `ruleInputs`): the file
  keeps the order keys were added in. After two clients add keys at once, their exports can list
  the same keys in a different order (same content). `rules` is made deterministic by its order
  key (R2); the others are left as today.

## R12. Tests

- **Unchanged suites** are the proof of US1: no public-API test is rewritten. The five model
  tests and two app tests that reach into the layout (`doc.getArray(…)`) are updated to the new
  layout or to the public API.
- **Round-trip:** existing cases, plus explicit `description: ""`, `branches: []`, a flow with
  steps out of normal order, and an explicit `serializeDeck(toJSON(fromJSON(f))) ===
serializeDeck(f)` over every example file and the generated 500 / 2,000 decks (SC-001).
- **`order-key.test.ts`:** ordering, bounds, 10,000 appends stay short, property test that
  `a < keyBetween(a, b) < b`.
- **`concurrency.test.ts`** (new, the heart of US2–US4): a helper makes two documents from one
  deck and exchanges updates; every scenario runs with both delivery orders and asserts both
  documents read as equal decks with every list in the same order (SC-003): move vs edit, move vs move, insert vs insert at one
  place and a later insert between the tied items, delete vs move, column add vs row add, cell vs
  cell, branch add vs step append, presets from both sides, typing at two places and at one place,
  clear vs type, first text from both sides, delete vs connect (+ undo), delete vs pin, fill clear
  vs stroke clear, parent cycle, undo after a remote reorder.
- **`repair.test.ts`:** runs only for non-local transactions, is not an undo step, settles after
  one round between two editors, and leaves a loaded file's dangling entries alone.
- **`legacy-layout.test.ts`:** a document built in the old layout is recognised; a new one and an
  empty one are not.
- **App:** `rebase-draft.test.ts` (pure), `use-live-field.test.tsx` (a remote change while typing
  keeps both texts and the caret), loader and library-ops tests for the unsupported outcome.
- **Performance:** `perf.test.ts` gains the 10,000-component edit and move budgets (SC-005);
  `pnpm bench` before and after (SC-006), and the storage load timing from
  `deck-persistence.perf.test.ts`.
- No new e2e (constitution VI); the smoke suite must stay green.
