# Contract: additions to `@sododeck/model` (003)

Additive to the 002 contract (`specs/002-yjs-model/contracts/model-api.md`). Nothing in the 002
API changes. Both live in `packages/model` because only the model may convert Yjs ↔ JSON and know
the cascade (constitution II). Implemented as the first 003 tasks (002 is merged).

## Incremental snapshot

```ts
interface DeckSnapshot {
  /** Current plain deck. A new top-level object after every change; untouched objects keep identity. */
  get(): SododeckFile;
  /** Called once per transaction, after `get()` is up to date. Returns unsubscribe. */
  subscribe(listener: () => void): () => void;
  destroy(): void;
}

function createDeckSnapshot(doc: DeckDoc): DeckSnapshot;
```

Guarantees:

- `snapshot.get()` deep-equals `toJSON(doc)` after every transaction (tested after each operation of
  the 002 edit suite).
- Structural sharing: after `update('nodes', id, …)`, `get().nodes[i]` for every other node, and
  `get().edges`, are the same references as before (`toBe`).
- One edit on the 500 / 1,000 deck updates the snapshot in < 2 ms (perf test).
- Works in the same environments as the rest of the model (no DOM).

## Removal preview

```ts
type RemovalTarget = {
  scope: 'nodes' | 'edges' | 'groups' | 'stickies' | 'flows' | 'views' | 'features';
  id: Id;
};

/** Pure. What `remove` would do for all targets together, without writing. */
function previewRemoval(file: SododeckFile, targets: RemovalTarget[]): RemovalResult;
```

Guarantees:

- For any deck and targets, `previewRemoval(toJSON(doc), targets)` equals the merged
  `RemovalResult` of removing the same targets in one `batch` (tested per cascade row in the 002
  data-model table).
- Implemented by running the real cascade on a throwaway copy of the document, so there is no
  second copy of the cascade rules.
- Objects removed by more than one target (e.g. an edge between two deleted nodes) appear once.
