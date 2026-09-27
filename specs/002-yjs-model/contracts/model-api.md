# Contract: `@sododeck/model` public API (002)

TypeScript signatures are the contract; bodies are implementation. Types `SododeckFile`, `Node`,
`Edge`, … and `Issue` come from `@sododeck/model`'s dependency `@sododeck/schema`. Everything below
is exported from `packages/model/src/index.ts`. No export exposes Yjs event types; `DeckDoc`
(= `Y.Doc`) stays exported for storage providers (005).

## Load and save (existing, extended)

```ts
type DeckDoc = Y.Doc;

function createDeck(): DeckDoc;
/** Validates (format + duplicate ids) and loads. Not undoable. @throws DeckValidationError */
function fromJSON(input: unknown): DeckDoc;
/** Plain file, canonical key order at every level (schema `properties` order). */
function toJSON(doc: DeckDoc): SododeckFile;
/** `JSON.stringify(canonical, null, 2) + '\n'`. */
function serializeDeck(file: SododeckFile): string;

class DeckValidationError extends Error {
  readonly issues: Issue[];
}
```

## Reading

```ts
type Collection = 'nodes' | 'groups' | 'edges' | 'views' | 'features' | 'flows' | 'stickies';
type ObjectOf<C extends Collection> = SododeckFile[C][number];

function getObject<C extends Collection>(doc: DeckDoc, c: C, id: Id): ObjectOf<C> | undefined;
function getRule(doc: DeckDoc, id: Id): Rule | undefined;

/** One call per transaction. Returns an unsubscribe function. */
function observeDeck(doc: DeckDoc, listener: (change: DeckChange) => void): () => void;
```

## Editing

```ts
interface EditorOptions {
  captureTimeout?: number; // default 500 ms (typing-burst window)
  newId?: (prefix: string) => Id; // default: crypto-random, see research R3
}

function createEditor(doc: DeckDoc, options?: EditorOptions): DeckEditor;

interface DeckEditor {
  readonly doc: DeckDoc;

  // deck metadata
  updateMeta(patch: Patch<Pick<SododeckFile, 'name' | 'description' | 'tags'>>): void;

  // top-level collections (move = update position; regroup = update group)
  add<C extends Collection>(c: C, data: NewObject<C>): Id;
  update<C extends Collection>(c: C, id: Id, patch: Patch<ObjectOf<C>>): void;
  remove(c: Collection, id: Id): RemovalResult; // applies the cascade in data-model.md
  reorder(c: Collection, id: Id, toIndex: number): void;

  // flow steps
  addStep(flowId: Id, data: NewStep, index?: number): Id;
  updateStep(flowId: Id, stepId: Id, patch: Patch<Step>): void;
  removeStep(flowId: Id, stepId: Id): RemovalResult;
  moveStep(flowId: Id, stepId: Id, toIndex: number): void;

  // rules (decision tables)
  addRule(data: NewRule): Id;
  updateRule(id: Id, patch: Patch<Omit<Rule, 'inputs' | 'outputs' | 'rows'>>): void;
  removeRule(id: Id): RemovalResult;
  addRuleColumn(ruleId: Id, side: 'inputs' | 'outputs', label: string, index?: number): Id;
  renameRuleColumn(ruleId: Id, columnId: Id, label: string): void;
  moveRuleColumn(ruleId: Id, columnId: Id, toIndex: number): void;
  removeRuleColumn(ruleId: Id, columnId: Id): RemovalResult;
  addRuleRow(ruleId: Id, cells?: { when?: string[]; then?: string[] }, index?: number): Id;
  setRuleCell(ruleId: Id, rowId: Id, columnId: Id, value: string): void;
  moveRuleRow(ruleId: Id, rowId: Id, toIndex: number): void;
  removeRuleRow(ruleId: Id, rowId: Id): void;

  // grouping
  batch<T>(fn: () => T): T; // one transaction, one undo step (nested batches flatten)
  beginGesture(): void; // e.g. drag start; counted, must be balanced
  endGesture(): void;

  // history (only this editor's edits)
  undo(): boolean; // false when nothing to undo
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  onHistoryChange(listener: () => void): () => void;
  destroy(): void; // detaches the UndoManager
}

class DeckEditError extends Error {
  readonly code: 'invalid' | 'not-found' | 'missing-reference' | 'duplicate-id';
  readonly issues: Issue[];
}
```

Guarantees:

- Every method validates first and throws `DeckEditError` without writing (research R4).
- After any successful call, `parseSododeckFile(toJSON(doc)).success === true` (SC-007).
- Ids passed in `data` or generated are never rewritten afterwards.

## Integrity

```ts
function checkIntegrity(file: SododeckFile): IntegrityProblem[]; // pure, worker-safe
```

`DeckChange`, `ObjectChange`, `ObjectRef`, `RemovalResult`, `IntegrityProblem`, `NewObject`,
`NewStep`, `NewRule` and `Patch` are exported types; shapes in [data-model.md](../data-model.md).

## Compatibility with current consumers

`apps/app` uses `fromJSON`, `toJSON`, `serializeDeck`, `DeckDoc`: signatures unchanged. `fromJSON`
additionally refuses duplicate ids (the app's sample/example decks have none; covered by a test).
