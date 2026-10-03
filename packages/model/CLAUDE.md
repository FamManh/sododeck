# @sododeck/model

**Responsibility:** the deck document. Owns the Yjs structure and is the **only** place that converts Yjs ↔ `.sododeck.json`. Every surface edits the deck through this package.

API (full contract: `specs/002-yjs-model/contracts/model-api.md`):

- **Load / save:** `createDeck()`, `fromJSON(input)` (validates format + duplicate ids, throws `DeckValidationError`; not undoable), `toJSON(doc)` (canonical key order at every level), `serializeDeck(file)`.
- **Read:** `getObject(doc, collection, id)`, `getRule(doc, id)`, `observeDeck(doc, listener)` → one `DeckChange` per transaction (`origin`: `local` / `undo` / `redo` / `remote`; changes name scope, id, child step/branch/column/row and changed keys).
- **Edit:** `createEditor(doc, { captureTimeout?, newId? })` → `DeckEditor`: `add` / `update` / `remove` / `reorder` for `nodes`, `groups`, `edges`, `views`, `features`, `flows`, `stickies`; step ops; rule, column, row and cell ops; `updateMeta`; `batch`; `beginGesture` / `endGesture`; `undo` / `redo` / `canUndo` / `canRedo` / `onHistoryChange`; `destroy`. Sticky-specific ops are `beginStickyDraft` / `endStickyDraft`, `pinSticky`, `unpinSticky` and `moveSticky`. Every op validates first and throws `DeckEditError` (`invalid`, `not-found`, `missing-reference`, `duplicate-id`) without writing. `remove*` returns a `RemovalResult` (`removed`, `updated`, `freed`, `broken`).
- **Integrity:** `checkIntegrity(file)`: pure, worker-safe list of broken reference (a component with no connections is not a problem: founder decision, 2026-09-28)s and parent cycles.
- **Added by 003** (contract: `specs/003-canvas-basic/contracts/model-additions.md`):
  - `createDeckSnapshot(doc)` → `DeckSnapshot` (`get`, `subscribe`, `destroy`): an incremental, structurally shared plain deck. Equals `toJSON(doc)` (key order included) after every transaction; untouched objects and collections keep their identity. The app reads the deck through it.
  - `previewRemoval(file, targets: RemovalTarget[])` → `RemovalResult`: what removing the targets in one batch would do, computed by running the real cascade on a throwaway copy. Objects hit by several targets appear once, and node deletes list stickies they free in `freed`.
- **Added by 004** (contract: `specs/004-json-panel-sync/contracts/model-additions.md`):
  - `serializeEntry(collection, value)`: one object (collection item or `rules` value) exactly as in the file, without the file's nesting indent. `serializeEntries(entries: Entry[])`: a JSON array of such objects. Both use the canonical key order; tested to equal slices of `serializeDeck`.
- **Added by 006** (contract: `specs/006-flow-authoring/contracts/model-additions.md`, ADR 0008):
  - `analyzeFlow(flow, edges)` → `FlowAnalysis`: pure. Main and branch paths, display numbers (`1…n`, `4a`), from/to, `broken` and `chainBreak` flags, next start node per path, the branch step, `problems` and `canFinish`. Numbers and from/to are never stored.
  - Editor ops: `appendStep(flowId, branchId | null, data)`, `addBranch(flowId, afterStepId, { label?, condition?, errorPath?, firstEdge? })` (splits the following main steps into alternative "a" the first time), `updateBranch`, `removeBranch` (with its steps), `restoreFlowStructure(flowId, checkpoint)`. `moveStep` refuses moves out of the step's path and past the branch step. `addStep` / `updateStep` / `add('flows')` refuse a `step.branch` that names no branch of the flow; `update('flows')` cannot patch `branches`.
  - `captureFlowStructure(file, flowId)` → opaque frozen `FlowCheckpoint` (edit-mode Cancel); `flowStructureChanged(file, checkpoint)`.
  - `observeDeck` reports branches as `child.kind: 'branch'` (also when the first branch creates the `branches` field or the last one deletes it). `RemovalTarget` gains `{ scope: 'branches', flowId, id }`. `checkIntegrity` reports a `step.branch` naming no branch of its flow (`targetType: 'branch'`). Branch ids are deck-unique and checked for duplicates per flow on load.
- **Added by 008** (contract: `specs/008-inspector-rules/contracts/model-additions.md`, ADR 0009):
  - `src/rules/`: pure decision-table semantics. `parseCell(text)` → `Cell` (`any`, `compare`, `exact`, `list`, `invalid`), `matchCell(cell, input)`, `evaluateRule(rule, inputs)` → `Evaluation` (`match` / `ambiguous` (Unique with several matches: no winner) / `none`), `ruleChecks(rule)` → `{ catchAll, invalidCells }`, `ruleUsage(file, ruleId)` → steps (numbered by `analyzeFlow`, broken flagged) and nodes using a rule.
  - Editor ops (`src/ops/rule-links.ts`): `attachRule(host, ruleId)`, `detachRule(host, ruleId)` with `RuleHost = { kind: 'node', id } | { kind: 'step', flowId, stepId }`, and `setRuleInputs(flowId, stepId, ruleId, values)` (drops empty values; keyed, so typing merges into one undo step).
  - `RemovalTarget` gains `{ scope: 'rules', id }`.
- **Added by 007** (flow playback):
  - `serializeEntry('steps', step)`: one flow step in the canonical key order of `flows[].steps` (the JSON panel shows the current step in flow mode). `canonicalizeEntry('steps', value)` likewise.
- **Added by 009** (stickies and palette foundation, ADR 0010):
  - `src/geometry.ts`: `Point`, `NODE_GRID`, `STICKY_DEFAULT_OFFSET`, `nodeCanvasPosition`, `stickyCanvasPosition`, `stickyLabel`.
  - `removeNode(id)` frees notes pinned to that node at the same canvas point in the same transaction; `RemovalResult.freed` reports those note ids, and `undo()` restores the pin and offset.
- **Added by 011** (saved views and auto-layout, contract: `specs/011-views-autolayout/contracts/model-views.md`, ADR 0012):
  - `src/views.ts` (pure): `VIEW_PRESETS` (System / Feature / Infra with fixed ids `system`, `feature`, `infra`), `PRESET_VIEW_IDS`, `CUSTOM_VIEW_DEFAULTS`, `resolveViews(file)` (stored views, else the presets, identity kept), `baseViewId`, `nextCustomTitle`. `geometry.ts` adds `viewPosition(file, view, nodeId)` and `viewNodePosition(view, node)`: a view's own position wins in any view, else the base position.
  - Editor ops (`src/ops/views.ts`): `moveInView` (base view → `node.position` and drops its own entry; other views → `view.positions`; unknown nodes skipped), `setPinned`, `updateView` (`ViewSettingsPatch`; `undefined` or `[]` removes a field; title typing burst is one step), `addView` ("Custom <n>"), `removeView` (refuses the last view), `setCollapsed`.
  - A deck without stored views gets the three presets written on its first view change, in a transaction of their own with the editor's second, **untracked** origin (in `editorOrigins`, not in the `UndoManager`), so undo never removes them. `setCollapsed` uses the same untracked origin: saved and synced, never an undo step.
  - Cascade: removing a node drops it from `pinned`; removing a group drops it from `excludeGroups` and `collapsed` (same transaction). `checkIntegrity` reports dangling ids in `pinned`, `excludeGroups` and `collapsed`.
- **Added by 015** (model validation, contract: `specs/015-model-validation/contracts/model-problems.md`, ADR 0013):
  - `src/problems.ts` (pure): `checkDeck(file)` → `DeckProblems` (`list` sorted by kind, object title, step order; `total`; `byObject` id → problems) and `PROBLEM_KINDS`. Nine kinds: duplicate connection, step without connection, broken chain, incomplete flow, overlapping branch conditions, missing rule, rule without catch-all, invalid rule cells, broken reference. Built on `analyzeFlow`, `ruleChecks` and `checkIntegrity` (step `edge` / `branch` integrity problems are left to `analyzeFlow`). Problem keys are stable (kind + ids). Derived for display; never stored.

- **Added by 016** (canvas editing, ADR 0017):
  - `geometry.ts`: `frameOf(group)` (the stored frame or undefined), `fitGroupFrames(file, { cardSize, padding, viewId? })` → `Map<groupId, Frame>` for groups with no frame (inner-first: member cards and child frames plus padding; empty groups and cycles skipped; with `viewId`, that view's positions, and a group counts as framed when the view or the base has a frame).
  - Editor ops (`src/ops/frames.ts`): `fillGroupFrames(base, perView?)` writes only missing frames, **untracked** (fitting on open is never an undo step); `setGroupFrames(viewId, frames)` mirrors `moveInView` (base view → `group.position` / `size` and drops its own entry; other views → `view.groupFrames`, after copying every base frame into it untracked the first time). Removing a group deletes its `groupFrames` entry in every view (cascade).
  - `src/fragment.ts` (pure): `toFragment(file, { nodes, groups }, viewId?)` (selected nodes, edges with both ends selected, selected groups whose whole subtree is selected; outside `group` / `parent` refs dropped; view positions), `serializeFragment`, `parseFragment(text)` (`null` for plain text, other JSON, invalid decks, duplicate ids), `fragmentOrigin`. Envelope `{ "sododeckFragment": 1, "deck": <file> }`.
  - `pasteFragment(fragment, { offset, parent?, viewId? })` (`src/ops/paste.ts`): one undo step, new ids, references remapped inside the fragment, top-level items into `parent`, unknown rule ids dropped, non-base view positions and frames written too. Returns the new ids.
  - `groupSelection({ nodes, groups, title, parent?, frame, viewFrames? })` (`src/ops/group-selection.ts`): one undo step; refuses a parent inside the selected groups.
  - `cancelGesture()`: ends the open gesture and undoes it; the redo stack held back during the gesture is restored, so both stacks are as before `beginGesture`.
- **Added by 017** (card resize and connector routing, ADR 0019):
  - `src/ops/shape.ts`: `setCardSize(nodeId, size | null)` sets or clears a node's stored `size`; does not clamp (the schema only requires both dimensions above 0 — clamping to the level's limits is the app's job). `setEdgeRoute(edgeId, patch | null)` merges an `EdgeRoutePatch` (`fromSide?`, `toSide?`, `offset?`, each `null` clearing that key) into the edge's `route`, key by key (so two tabs changing different keys both keep their change); `offset: 0` is dropped; `null` clears the whole route. Both join an open gesture (one undo step per drag, one per burst).
  - `fitGroupFrames` gains `sizeOf?: (node) => Size`, used instead of `cardSize` for a member with a stored size, so group frames fit resized cards.
  - `problems.ts` gains the `'card-size-out-of-range'` kind: a stored `node.size` outside `CARD_SIZE_RANGE` (120×44 to 800×600, mirroring the app's clamp limits, checked at the model layer so a foreign or corrupted file is still flagged).

- **Added by 036** (collaboration-ready document, ADR 0021; contract: `specs/036-collab-ready-document/contracts/model-contract.md`):
  - **Layout 2:** every list (the seven collections, a flow's `steps` and `branches`, a rule's `inputs`, `outputs` and `rows`, and `rules` itself) is a `Y.Map<id, Y.Map>`; the id is the key; items carry a fractional-index `$order` (`order-key.ts`) and lists read sorted by (`$order`, id). A move is one key change; a delete takes concurrent edits inside the item with it. Rule rows store `cells: Y.Map<columnId, string>`. A flow's steps keep one flat order (R4).
  - **Long text** (`text-fields.ts`): every markdown field plus step `payload` is a `Y.Text`, always present, written by `writeText` (minimal splice, `text.ts`). `$blank:<field>` keeps an explicit `""` (and `$blank:branches` a file's `branches: []`). Short text stays last write wins.
  - **Reader / writer rule:** `read.ts` (`readObject`, `readRule`, `readRow`, `readMeta`, `readCollection`, `readRules`) and `write.ts` (`createObject`, `createRule`, `createRow`, `writeField`, `writeFields`) are the only code that knows the layout. Never `fromY` / `toY` a deck object. `$…` keys are internal: never output, never in `DeckChange.keys`. `Y.Text`, order keys and markers never leave the package.
  - `layout.ts` list helpers: `collectionMap`, `childList`, `orderedEntries`, `orderedIds`, `insertAt` (re-keys a tied run), `appendAll`, `planMove`; `ops/context.ts`'s `requireEntry` replaces index lookups.
  - `isLegacyLayout(doc)`: true for a document stored in layout 1 (callers that build a document from stored bytes check it; `toJSON`, snapshots and editors must not be used on such a document).
  - `EditorOptions.repair` (default `true`): after a change that is not the editor's own and that removed a component or group or touched a view, `repairViewRefs` (`repair.ts`) removes view entries naming nothing, with the untracked origin (never an undo step). Throwaway editors (`previewRemoval`, the library worker) pass `false`. An empty `style` reads as no style.

## Rules

- Round-trip must be lossless: `toJSON(fromJSON(x))` deep-equals `x` for every valid file. Every new field or object type gets a round-trip test case (`test/round-trip.test.ts`).
- Ids are stable. Never derive ids from titles; never rewrite ids on rename.
- The Yjs layout is documented at the top of `src/deck.ts` and in ADR 0021 (layout 2, amending ADR 0005). Changing it needs an ADR; decks stored before 036 are refused, not migrated (founder, §g-81 / §g-82).
- Validate before writing (Yjs cannot roll back). Validity comes from the generated Zod in `@sododeck/schema`; never redefine it here.
- Delete policy (ADR 0005): edges and owned steps are removed; steps and stickies are kept and reported broken; groups re-parent their contents. A branch owns its steps (ADR 0008).
- ADR 0010 amends node deletes only: stickies pinned to a removed node become free at the same screen point, reported in `RemovalResult.freed`, and restored by one undo.
- Flow steps stay in normal order (main path first, then each branch's steps in `branches` order); branch ops keep it. Concurrent edits from two clients may interleave paths in the flat order; `analyzeFlow` partitions by path, so that is harmless (036 R4).
- Rule links (008): attach, detach and sample inputs go through `attachRule` / `detachRule` / `setRuleInputs`, never raw `rules` / `ruleInputs` patches. `step.ruleInputs` keys stay a subset of the step's rules and their input columns; detaching from a step drops its sample inputs in the same transaction.
- View internals (`positions`, `pinned`, `collapsed`, filters, `subtitleField`, `title` from the switcher) are written only through the view ops, never through `update('views', …)` from the app (011).
- Undo covers only the editor's own tracked origin; the untracked view-state origin (011) is never undone. Field edits pass an object key to `ctx.transact` so a typing burst on one object is one step.

## Layout of `src/`

- `deck.ts` load/save + layout doc · `layout.ts` root types, list helpers, `isLegacyLayout` · `read.ts` / `write.ts` the only reader and writer of deck objects (036) · `order-key.ts` fractional-index keys · `text.ts` / `text-fields.ts` long text · `repair.ts` view repair on receive · `convert.ts` plain JSON ↔ Y for nested values · `geometry.ts` sticky and node canvas geometry (009)
- `key-order.ts` canonical order from the schema · `load-checks.ts` duplicate ids · `ids.ts` id generator
- `validate.ts` per-object validation · `errors.ts` · `editor.ts` · `observe.ts` · `integrity.ts`
- `snapshot.ts` incremental read model (003) · `preview.ts` removal preview (003) · `serialize-entry.ts` text of single objects (004) · `flow-paths.ts` flow path derivation (006) · `problems.ts` deck-wide problems (015)
- `rules/`: `cells.ts`, `evaluate.ts`, `usage.ts` (008, pure)
- `views.ts` presets and view resolution (011)
- `ops/`: `collections`, `steps`, `branches` (006), `rules`, `rule-links` (008), `views` (011), `frames`, `paste`, `group-selection` (016), `meta`, `cascade`, `style`, `swatches` (020), plus `context` (what ops get from the editor), `patch`, `refs`, `types`
- `fragment.ts` clipboard fragments (016)

## Boundaries

- No React, no DOM, no storage providers (the IndexedDB and tab-sync providers live in `apps/app/src/storage`, ADR 0007). Must run in Node and in Web Workers. ESLint enforces this for `src/` (no `node:*`, React or y-indexeddb imports; no `window`, `document`, `localStorage`, `indexedDB`, `navigator`).
- Does not define the file format (that is `@sododeck/schema`). No direct `zod` dependency: schemas come from `sododeckFileSchema`.

## Status

Feature 002 complete: editor API, delete cascade, rule tables, undo grouping and gestures, change events, load-time duplicate-id refusal, canonical key order, integrity report, perf test (500 nodes / 1,000 edges). 003 added the snapshot and the removal preview. 006 added flow branches, `analyzeFlow` and the edit-mode checkpoint. 008 added rule evaluation, rule usage and the rule-link ops. 011 added saved views: presets, view ops, the untracked collapse origin and the view cascade.

020 added card style: `ops/style.ts`'s `setStyle(ctx, targets, channel, value)` writes `fill`/`stroke` key by key into a node or group's nested `style` `Y.Map` (like `writeFields` in `ops/frames.ts`), so concurrent edits to different channels merge; validates against the `style` entry in `validate.ts`'s `ELEMENT_SCHEMAS` before writing. `ops/swatches.ts`'s `addSwatch`/`removeSwatch` operate on the deck's `swatches` `Y.Array` (`MAX_SWATCHES = 12`); `fromJSON` always creates this array (even empty) so concurrent `addSwatch` calls in two tabs share one `Y.Array` from the start instead of racing to create it — `toJSON` and `snapshot.ts` both omit it from output when empty, keeping old decks byte-stable. `layout.ts` exports `swatchesArray(doc)` for this shared read.
