# Research: Apply a changed deck file to an open deck (066)

Evidence was read from `packages/model/src` (`deck.ts`, `layout.ts`, `read.ts`, `write.ts`, `text.ts`, `editor.ts`, `observe.ts`, `assets.ts`, `import-check.ts`, `load-checks.ts`, `legacy-stickies.ts`) on `main` at `d2e225d5`. Undo behaviour was checked with a throwaway Yjs script (R4, R7).

## R1. Where the diff runs and what it compares

- **Decision**: A new model module `src/apply-file.ts`. It reads each stored object as plain data with the existing readers (`readObject`, `readRule`, `readMeta`, `readField`, `readEnum`), compares it with the matching object of the validated incoming file, and writes only the differences through the existing writers (`createObject`, `createRule`, `createRow`, `createField`, `createEnum`, `writeField`, `insertAt` / `setOrder`). Everything happens in one `doc.transact(fn, origin)`.
- **Rationale**: `read.ts` and `write.ts` are the only code that knows layout 2 (ADR 0021). Comparing plain values keeps the diff independent of `$order`, `$blank:` markers, `Y.Text` and `$value:` keys, and writing through `write.ts` keeps them right. The editor's ops are not used: they validate one change at a time, refuse locked objects, cascade removals and record undo steps. The incoming file has already been validated as a whole, so none of that applies (FR-017).
- **Alternatives rejected**: (a) Rebuild the document from the file. That is a new doc: selection, snapshot identity and undo are lost, which is the problem this feature solves. (b) Clear each collection and refill it. Every object would report a change and be re-created, which breaks undo items and SC-002. (c) Build a second Y.Doc from the file and merge Yjs updates. The two docs share no history, so Yjs would keep both copies of every item.

## R2. Equal-file fast path (FR-007, echo in 067)

- **Decision**: Before diffing, compare the canonical JSON of `toJSON(doc)` with the canonical JSON of the prepared file. If they are equal, return `changed: false` without opening a transaction. Otherwise run the per-object diff. Every per-object write is also guarded by a value comparison, so a diff that finds nothing writes nothing.
- **Rationale**: 067's echo case (the host sends back the file the editor just wrote) becomes one serialization and one string compare. With no transaction there is no `observeDeck` event and no storage update.
- **Alternative rejected**: Relying only on Yjs skipping empty transactions. A write of an equal value still creates an item in Yjs (`map.set` always inserts), so the guards are needed anyway, and the fast path saves the walk.

## R3. Ordered lists (FR-005)

- **Decision**: For every ordered list (the eight collections, rules, a flow's steps and branches, a rule's inputs, outputs and rows, a table's columns, indexes and checks, `meta.fields` and their options, `meta.enums` and their values), reconcile in three passes:
  1. Remove the ids that are absent from the file.
  2. Find the longest increasing subsequence of the kept items' current positions, taken in file order. Items on that subsequence keep their order keys.
  3. Walk the file order. Each kept item off the subsequence gets a new key between its already-placed neighbours (`keyBetween`). Each new item is created with such a key.

  If a key cannot be generated (malformed keys), fall back to re-keying the whole list, as `insertAt` already does.

- **Rationale**: The fewest key changes that reach the file's order. A list where one item moved writes one key, so other items report no change (US1 AS4). The LIS is O(n log n).
- **Alternative rejected**: Re-keying the whole list whenever the order differs. Every item would report a change, and every item would also conflict with a concurrent tab's move.

## R4. Long text fields (FR-018, US2 AS3)

- **Decision**: A long text field (`text-fields.ts`: descriptions, note text, flow step text…) whose value differs gets a **fresh `Y.Text`** holding the file's value (`map.set(key, new Y.Text(value))`), plus the blank marker rule from `writeField`. An equal value is not touched.
- **Rationale**: Checked with Yjs: when the file's change is spliced into the existing `Y.Text` (what `writeText` does for user edits), a later user undo of their own typing removes their characters from the merged text. The result matches neither the file nor the user's text (`"hello world!" + " x"` typed, file appends `Y`, undo → `"hello world!Y"`). With a fresh `Y.Text`, the user's undo works on the detached old text and the field keeps the file's value, which is the clarified "file wins, whole value" rule. No app code holds a `Y.Text` (they never leave the package), so swapping the object is invisible outside the model.
- **Cost accepted**: Two tabs typing in that one field at the moment a file lands fall back to last-writer-wins for that field. This is rare, and conflicts are the host's concern (spec Assumptions).

## R5. Fields inside an object

- **Decision**:
  - Scalars and whole-value arrays (`tags`, `links`, `rules`, `includes`, index `columns`…): write the new value if it differs, as `writeField` does.
  - `position` / `size`: per-axis writes (`writeField` already keeps the nested map).
  - Nested records stored as `Y.Map` (`style`, a view's `positions` and `groupFrames`, `ruleInputs`, meta `tagColors`, `packs`, `fieldDefaults`, `tableDisplay`, `relationshipDisplay`, `canvasBackground`, asset metas): merge key by key, recursively for map-in-map. Only changed keys are written; keys missing from the file are removed.
  - `meta.swatches` (`Y.Array`, always present): replace the contents of the existing array when it differs, keeping the shared array (020 R3).
  - Typed values (`$value:<field>`): the existing `writeValues` rule.
  - `$schema`, `version`, `name`, `dialect`, `groupingMode`, `blockSqlExport`: scalars on `meta`.
  - Flow `branches: []`: keep the `$blank:branches` marker rule from `createObject`.
- **Rationale**: Moving one card writes one key of one view's `positions` map. Without the key merge, the whole map would be replaced, which still counts as one object changing but conflicts with every concurrent move in that view.

## R6. Validation, upgrades and "apply = load" (FR-010, FR-011)

- **Decision**: Split `loadDeck` into a pure `prepareDeck(input)` and `buildDoc(prepared)`. `prepareDeck` runs `repairAssets` → `trimCrops` → `validateDeckFile` → `freeAnchoredStickies` and returns `{ file, metas, bytes, problems, trimmedCrops }`. `loadDeck` = `buildDoc(prepareDeck(input))`, with unchanged behaviour. `applyFile` = `prepareDeck` + diff. For text, `applyDeckText(doc, text, origin)` reuses `inspectDeckText`'s first half (BOM strip, JSON parse with `invalid-json` entry, `unsupported-version` entry). That half is extracted as `parseDeckText(text)` so the refusal entries are the very ones a file import shows (062).
- **Rationale**: One pipeline guarantees that applying B gives the same deck as loading B, for legacy notes, trimmed crops and damaged pictures alike.
- **Refusal shape**: `ProblemEntry[]` (the 062 import entries, sorted), never a throw for user input.

## R7. Origin, undo and observers (FR-008, FR-009)

- **Decision**: `applyFile(doc, input, origin: object)`. The caller's origin is any object that is not an editor origin. An editor origin (in `editorOrigins`) is a programming error and throws `TypeError`, because it would make the change undoable. No new `DeckChange.origin` kind: observers see `'remote'`, as for storage loads and other tabs, and the editor's view-ref repair runs as for any remote change (it finds nothing, because the file is valid).
- **Checked with Yjs** (UndoManager tracking only the editor origin):
  - A user sets a field, the file overwrites it, the user undoes: the file's value stays and the undo step is spent (US2 AS3).
  - A user deletes an object, the file re-adds the same id, the user undoes: the file's object stays.
  - An untracked transaction in the middle of a capture window does not split the user's step (US2 AS4). This matches the 046 note in `packages/model/CLAUDE.md`.
- **Rationale**: Untracked origins are already how storage loads (`storageOrigin`) and view state stay out of undo. The app's storage saves anything whose origin is not storage or channel, so an applied change is autosaved like any edit (wanted in the web app; 067 decides for hosts).
- **Alternative rejected**: A new `'external'` origin kind. It has no consumer in 066. 067 detects echoes by comparing file text, not by origin. It can be added there if a surface needs it.

## R8. Pictures (FR-013, US4)

- **Decision**: Picture bytes come back in the result (`bytes`, from `prepareDeck`), and the caller stores them in its blob store, as after `loadDeck`. Asset metas are merged key by key for pictures the file lists. A picture entry with `data: ''` keeps its facts and never clears bytes, because bytes are not in the document. Asset metas the file no longer uses are **not** removed: `toJSON` emits only used pictures (rule I2), so the round trip still holds, and a user's undo of an image delete keeps its picture facts.
- **Damaged picture data**: stored as a placeholder meta exactly as on load, and listed in `problems`.

## R9. Change summary (FR-012)

- **Decision**: `summary: Record<Scope, { added: number; changed: number; removed: number }>` counting top-level objects per scope (`meta` counts as one changed object when any meta field changed). A change to a child item counts its owner as changed. Collected while diffing, not from `observeDeck`.

## R10. Performance (SC-003)

- **Decision**: Measure in `packages/model/test/perf.test.ts` with `largeDeck()` (500 nodes / 1,000 edges / 20 flows): one changed field under 50 ms, every object changed under 1 s, with the same CI tolerance pattern as the existing perf tests. The cost is `prepareDeck` (validation) + `toJSON` + an O(n) walk with id maps.
- **Main thread**: Yjs documents live on the main thread and all editor ops already run there. Validation of a 500-node file is part of the measured budget. If the bench shows it dominating, 067 can call the pure, exported `prepareDeck` in a worker and pass the prepared file in (`TODO(067)` noted in the contract). This is not needed for 066.

## R11. Fixture corpus for the pairwise round trip (FR-014, SC-001)

- **Decision**: The corpus is the schema examples (`minimal`, `flow-and-rule`, `full`), the `perType` cases of `round-trip.test.ts`, a database deck (`shopDeck`), an images deck (`image-helpers.ts`), `largeDeck` small size, and an empty deck. Every ordered pair (A, B) is checked: `toJSON(apply(load(A), B))` equals `toJSON(load(B))`, and serialized bytes are equal. Plus a property test that applies random edits (rename, move, reorder, add, remove, nested child edits) generated by the test, with no new dependency.
