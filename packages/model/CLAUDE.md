# @sododeck/model

**Responsibility:** the deck document. Owns the Yjs structure and is the **only** place that converts Yjs ↔ `.sododeck.json`. Every surface edits the deck through this package.

API (full contract: `specs/002-yjs-model/contracts/model-api.md`):

- **Load / save:** `createDeck()`, `fromJSON(input)` (validates format + duplicate ids, throws `DeckValidationError`; not undoable), `toJSON(doc)` (canonical key order at every level), `serializeDeck(file)`.
- **Read:** `getObject(doc, collection, id)`, `getRule(doc, id)`, `observeDeck(doc, listener)` → one `DeckChange` per transaction (`origin`: `local` / `undo` / `redo` / `remote`; changes name scope, id, child step/branch/column/row and changed keys).
- **Edit:** `createEditor(doc, { captureTimeout?, newId? })` → `DeckEditor`: `add` / `update` / `remove` / `reorder` for `nodes`, `groups`, `edges`, `views`, `features`, `flows`, `stickies`; step ops; rule, column, row and cell ops; `updateMeta`; `batch`; `beginGesture` / `endGesture`; `undo` / `redo` / `canUndo` / `canRedo` / `onHistoryChange`; `destroy`. Every op validates first and throws `DeckEditError` (`invalid`, `not-found`, `missing-reference`, `duplicate-id`) without writing. `remove*` returns a `RemovalResult` (`removed`, `updated`, `broken`).
- **Integrity:** `checkIntegrity(file)`: pure, worker-safe list of broken references and parent cycles.
- **Added by 003** (contract: `specs/003-canvas-basic/contracts/model-additions.md`):
  - `createDeckSnapshot(doc)` → `DeckSnapshot` (`get`, `subscribe`, `destroy`): an incremental, structurally shared plain deck. Equals `toJSON(doc)` (key order included) after every transaction; untouched objects and collections keep their identity. The app reads the deck through it.
  - `previewRemoval(file, targets: RemovalTarget[])` → `RemovalResult`: what removing the targets in one batch would do, computed by running the real cascade on a throwaway copy. Objects hit by several targets appear once.
- **Added by 004** (contract: `specs/004-json-panel-sync/contracts/model-additions.md`):
  - `serializeEntry(collection, value)`: one object (collection item or `rules` value) exactly as in the file, without the file's nesting indent. `serializeEntries(entries: Entry[])`: a JSON array of such objects. Both use the canonical key order; tested to equal slices of `serializeDeck`.
- **Added by 006** (contract: `specs/006-flow-authoring/contracts/model-additions.md`, ADR 0008):
  - `analyzeFlow(flow, edges)` → `FlowAnalysis`: pure. Main and branch paths, display numbers (`1…n`, `4a`), from/to, `broken` and `chainBreak` flags, next start node per path, the branch step, `problems` and `canFinish`. Numbers and from/to are never stored.
  - Editor ops: `appendStep(flowId, branchId | null, data)`, `addBranch(flowId, afterStepId, { label?, condition?, errorPath?, firstEdge? })` (splits the following main steps into alternative "a" the first time), `updateBranch`, `removeBranch` (with its steps), `restoreFlowStructure(flowId, checkpoint)`. `moveStep` refuses moves out of the step's path and past the branch step. `addStep` / `updateStep` / `add('flows')` refuse a `step.branch` that names no branch of the flow; `update('flows')` cannot patch `branches`.
  - `captureFlowStructure(file, flowId)` → opaque frozen `FlowCheckpoint` (edit-mode Cancel); `flowStructureChanged(file, checkpoint)`.
  - `observeDeck` reports branches as `child.kind: 'branch'` (also when the first branch creates the `branches` field or the last one deletes it). `RemovalTarget` gains `{ scope: 'branches', flowId, id }`. `checkIntegrity` reports a `step.branch` naming no branch of its flow (`targetType: 'branch'`). Branch ids are deck-unique and checked for duplicates per flow on load.

## Rules

- Round-trip must be lossless: `toJSON(fromJSON(x))` deep-equals `x` for every valid file. Every new field or object type gets a round-trip test case (`test/round-trip.test.ts`).
- Ids are stable. Never derive ids from titles; never rewrite ids on rename.
- The Yjs layout is documented at the top of `src/deck.ts` and in ADR 0005. It is persisted from 005 on: changing it needs an ADR and a migration.
- Validate before writing (Yjs cannot roll back). Validity comes from the generated Zod in `@sododeck/schema`; never redefine it here.
- Delete policy (ADR 0005): edges and owned steps are removed; steps and stickies are kept and reported broken; groups re-parent their contents. A branch owns its steps (ADR 0008).
- Flow steps stay in normal order (main path first, then each branch's steps in `branches` order); branch ops keep it.
- Undo covers only the editor's own origin. Field edits pass an object key to `ctx.transact` so a typing burst on one object is one step.

## Layout of `src/`

- `deck.ts` load/save + layout doc · `layout.ts` root types and lookups · `convert.ts` JSON ↔ Y
- `key-order.ts` canonical order from the schema · `load-checks.ts` duplicate ids · `ids.ts` id generator
- `validate.ts` per-object validation · `errors.ts` · `editor.ts` · `observe.ts` · `integrity.ts`
- `snapshot.ts` incremental read model (003) · `preview.ts` removal preview (003) · `serialize-entry.ts` text of single objects (004) · `flow-paths.ts` flow path derivation (006)
- `ops/`: `collections`, `steps`, `branches` (006), `rules`, `meta`, `cascade`, plus `context` (what ops get from the editor), `patch`, `refs`, `types`

## Boundaries

- No React, no DOM, no storage providers (the IndexedDB and tab-sync providers live in `apps/app/src/storage`, ADR 0007). Must run in Node and in Web Workers. ESLint enforces this for `src/` (no `node:*`, React or y-indexeddb imports; no `window`, `document`, `localStorage`, `indexedDB`, `navigator`).
- Does not define the file format (that is `@sododeck/schema`). No direct `zod` dependency: schemas come from `sododeckFileSchema`.

## Status

Feature 002 complete: editor API, delete cascade, rule tables, undo grouping and gestures, change events, load-time duplicate-id refusal, canonical key order, integrity report, perf test (500 nodes / 1,000 edges). 003 added the snapshot and the removal preview. 006 added flow branches, `analyzeFlow` and the edit-mode checkpoint.
