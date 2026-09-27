# Research: Deck Document Model (002)

All Technical Context unknowns are resolved below. Yjs facts were checked against the Yjs docs
(context7 `/yjs/docs`) and the installed source (`yjs` 13.6.33, `lib0`).

## R1. Yjs document layout

- **Decision**: Keep the skeleton layout and make it the documented, persisted layout (ADR 0005):
  - `doc.getMap('meta')`: `$schema`, `version`, `name?`, `description?`, `tags?` (Y.Array).
  - `doc.getArray(c)` for `nodes`, `groups`, `edges`, `views`, `features`, `flows`, `stickies`:
    one `Y.Map` per object, in file order.
  - `doc.getMap('rules')`: rule id → `Y.Map`.
  - Inside objects: nested objects (`position`, `positions`, `ruleInputs`, link) → `Y.Map`;
    arrays (`tags`, `links`, `rules`, `includes`, `steps`, `inputs`, `outputs`, `rows`, `when`,
    `then`) → `Y.Array`; scalars (including all text) → plain values.
- **Rationale**: Every field is individually mergeable (FR-004); file order of collections, steps,
  rows and columns is preserved for lossless round-trip; no data migration needed because nothing
  is persisted yet (005 starts persisting). Linear id lookup over ≤ 1,000 items per collection is
  well inside the 16 ms edit budget (SC-004).
- **Alternatives considered**:
  - Collections as `Y.Map` keyed by id plus a separate order array: O(1) lookup, but two
    structures to keep consistent and a harder round-trip; not needed at MVP scale.
  - `Y.Text` for titles/markdown: character-level merge for real-time collaboration, but
    collaboration is post-MVP, and it complicates every read/write. Plain strings are
    last-writer-wins per field. Switching later is a layout change → ADR + migration (recorded
    as a known trade-off in ADR 0005).

## R2. Canonical key order on write-out

- **Decision**: `toJSON` rebuilds every object in the key order of the `properties` declarations in
  `@sododeck/schema`'s `jsonSchema` (ADR 0004 §10), by walking the schema (`$ref`, `properties`,
  `items`, `additionalProperties`). The walk is computed once and cached. Map-like objects
  (`rules`, `views[].positions`, `steps[].ruleInputs`) keep their Yjs insertion order.
- **Rationale**: Y.Map key order is not a contract; deriving order from the schema means one source
  of truth and no hand-maintained tables that drift. Output is then byte-stable for `serializeDeck`.
- **Alternatives considered**: Hand-written key-order tables per type (drift risk); sorting keys
  alphabetically (breaks the documented order and the round-trip of example files).
- **Note**: A Y.Map rebuilt from an encoded update integrates items in clock order, so map-like
  objects keep their original order across persistence/sync; a test serializes a replica and
  compares strings.

## R3. Id generation

- **Decision**: `newId(kind)` = `<prefix>-<10 random base-36 chars>` from
  `globalThis.crypto.getRandomValues` (e.g. `node-k3j9x0q2ab`, `edge-…`, `step-…`, `row-…`,
  `col-…`, `rule-…`). Retried on the (negligible) chance of a collision with an existing id in the
  deck. Editors accept an injected generator for deterministic tests.
- **Rationale**: Matches the id pattern (≤ 64 chars, `[A-Za-z0-9_.:-]`); the prefix is the object
  _type_, never its title (constitution III), and keeps git diffs readable. `crypto.getRandomValues`
  is available in every supported browser, Web Workers and Node ≥ 24 without a dependency or
  secure-context requirement (unlike `randomUUID`). 36^10 ≈ 3.7 × 10^15 values → no practical
  collisions at 10,000 objects (spec US5 AS3).
- **Uniqueness scope**: generated ids are unique across the whole deck (not only per
  collection), so sticky anchors, which may point at any object type, are unambiguous.
- **Alternatives considered**: `nanoid` (new dependency, no gain); UUIDs (36 chars, noisy diffs);
  counters (collide across tabs/merges).

## R4. Validating edits (Yjs has no rollback)

- **Decision**: Validate **before** writing. Each operation builds the candidate plain object
  (current value + patch), validates it with the element schema taken from the generated Zod
  (`sododeckFileSchema.shape.nodes.element`, etc.; rules via the `rules` record value schema),
  runs the schema's semantic check on rules (`checkSemanticRules` over a one-rule file), checks new
  references resolve, and only then writes inside one transaction. Failures throw `DeckEditError`
  and leave the deck untouched (FR-007, SC-007).
- **Rationale**: Yjs transactions cannot be aborted; a write-then-validate approach would need
  compensating writes and would pollute undo history and remote peers. Reusing the generated Zod
  keeps one definition of validity (constitution II), with no change to `packages/schema`.
- **Alternatives considered**: Validating the whole file after every edit (too slow for drags on
  large decks); adding per-type exports to the schema generator (touches 001's package; not
  needed since the Zod object exposes `shape`).

## R5. Undo/redo with `Y.UndoManager`

- **Decision**: One `Y.UndoManager` per editor, scoped to all root types (`meta`, every collection,
  `rules`), with `trackedOrigins = new Set([editor.origin])` where `origin` is a unique object per
  editor, and every editor write runs in `doc.transact(fn, origin)`.
  - Typing bursts: default `captureTimeout` 500 ms merges consecutive edits (Yjs default).
    The editor calls `stopCapturing()` when a field update targets a different object than the
    previous update, so a burst never merges edits on two objects.
  - Gestures: `beginGesture()` calls `stopCapturing()` and sets `captureTimeout = Infinity` (a
    public, mutable field in `UndoManager.js`); `endGesture()` restores it and calls
    `stopCapturing()`. One drag = one undo step regardless of pauses (FR-027). Nested begin/end
    are counted.
  - `batch(fn)` runs `fn` in one transaction → one stack item (FR-008). Cascaded deletes use it.
  - Loads are not undoable: `fromJSON` fills the doc before any editor exists, and transactions
    without the editor's origin (loads, providers, other tabs) are never tracked (FR-024, FR-025).
  - Redo is cleared by Yjs on a new tracked change (FR-028). `canUndo()`/`canRedo()` plus
    `stack-item-added`/`stack-item-popped` events drive `onHistoryChange` (FR-029).
- **Testing note**: lib0 captures `Date.now` at import (`export const getUnixTime = Date.now`), so
  Vitest fake timers do not affect grouping. Tests use the injectable `captureTimeout` (e.g. 50 ms
  with real short waits for the boundary case, `Infinity`/`stopCapturing` for deterministic
  grouping).
- **Alternatives considered**: A hand-written command stack (duplicates Yjs, breaks with remote
  changes); one UndoManager per collection (a cascade across collections would be several steps).

## R6. Change observation

- **Decision**: `observeDeck(doc, listener)` registers `observeDeep` on each root type and emits one
  `DeckChange` per transaction (collected, then flushed on `afterTransaction`) listing
  `{ scope, id, kind: 'added' | 'updated' | 'removed', keys }` for each touched object (steps and
  rule rows/columns reported via their flow/rule plus the child id), and the origin class
  (`'local' | 'undo' | 'redo' | 'remote'`).
- **Rationale**: Surfaces (canvas 003, JSON panel 004) update incrementally (FR-002) without
  depending on Yjs event shapes; the translation lives in the only package allowed to know the
  layout (constitution II).
- **Alternatives considered**: Exposing raw Yjs events (leaks layout to the app); re-running
  `toJSON` on every change (fine for 004's panel, too slow for drag on the canvas).

## R7. Load-time identity checks

- **Decision**: `fromJSON` runs `parseSododeckFile` and then `checkDuplicateIds(file)`: duplicates
  within each array collection, within each flow's steps, and within each rule's columns (inputs
  and outputs together, one namespace) and rows. Violations throw `DeckValidationError` with one
  issue per duplicate naming the id and both paths (FR-020). Dangling references do **not** block
  loading; they appear in `checkIntegrity` (FR-021). Ids shared across _different_ collections are
  allowed on load (the format permits it) and surface as `ambiguous-anchor` only when a sticky
  anchor matches more than one object.

## R8. Integrity report

- **Decision**: `checkIntegrity(file: SododeckFile): IntegrityProblem[]`, a pure function over
  the plain file (runs on `toJSON(doc)` output, in a worker if needed). Builds id sets once, then one
  pass per collection; cycle detection for group and node `parent` chains with a visited set.
  Problem kinds and fields: see [data-model.md](data-model.md#integrity-problem).
- **Rationale**: Pure and JSON-based → trivially testable, worker-safe (constitution V), and
  reusable by 015 and a future CLI on files that were never loaded.

## R9. Browser-free guarantee

- **Decision**: The package keeps `types: ["node"]` for tests, and `src/` is guarded by an ESLint
  `no-restricted-imports` rule forbidding `node:*` and any DOM/React import, and by
  `no-restricted-globals` for `window`, `document`, `localStorage`, `indexedDB`. Tests run in
  Vitest's default `node` environment (FR-032, SC-006). `globalThis.crypto` is the only platform API
  used (available in Node, browsers and workers).

## R10. Dependencies and performance verification

- **Decision**: No new dependency (`yjs` already present; `zod` via `@sododeck/schema`). Performance
  is verified by a Vitest test on a generated deck (500 nodes, 1,000 edges, 20 flows × 10 steps,
  10 rules) asserting load, write-out and `checkIntegrity` < 200 ms each and a single
  rename/move < 16 ms (SC-003/004), with a generous CI multiplier documented in the test.
  `pnpm bench` is not required: no canvas change.
