# Contract: Storage API (`apps/app/src/storage`)

Internal module contracts for 005. Types are TypeScript signatures; bodies are implementation
detail. Records are defined in [data-model.md](../data-model.md).

## `library-db.ts`

```ts
export class LibraryDb extends Dexie {
  decks: EntityTable<DeckRecord, 'id'>;
  folders: EntityTable<FolderRecord, 'id'>;
  updates: EntityTable<UpdateRow, 'seq'>;
}
export function openLibraryDb(name?: string): Promise<LibraryDb | null>; // null = storage unavailable

// Decks
export function insertDeck(db, record: DeckRecord, bytes: Uint8Array): Promise<void>; // one tx
export function moveDeck(db, id: string, folderId: string | null): Promise<void>;
export function markOpened(db, id: string, at?: number): Promise<void>;
export function markExported(db, id: string, at?: number): Promise<void>;
export function softDeleteDeck(db, id: string): Promise<void>;
export function restoreDeck(db, id: string): Promise<void>;
export function loadDeckLog(
  db,
  id: string,
): Promise<{ record: DeckRecord; bytes: Uint8Array[] } | null>;

// Folders — throw FolderNameError('empty' | 'duplicate' | 'too-long')
export function createFolder(db, name: string): Promise<FolderRecord>;
export function renameFolder(db, id: string, name: string): Promise<void>;
export function softDeleteFolder(db, id: string): Promise<{ deckIds: string[] }>;
export function restoreFolder(db, id: string, deckIds: string[]): Promise<void>;

export function purgeDeleted(db): Promise<void>; // called once on app start
```

Guarantees: every function that touches more than one table runs in one Dexie transaction;
queries used by the UI exclude `deletedAt !== null`.

## `use-live-query.ts`

```ts
export function useLiveQuery<T>(query: () => Promise<T>, deps: unknown[]): T | undefined;
```

Re-renders when any tab changes the queried tables (Dexie `liveQuery`). `undefined` while loading.

## `deck-persistence.ts` (Yjs provider)

```ts
export interface DeckPersistence {
  readonly whenLoaded: Promise<void>; // stored log applied (storage origin)
  flush(): Promise<void>; // write the buffer now (⌘S / Retry / pagehide)
  storeRemoteDelta(bytes: Uint8Array): Promise<void>; // library-worker deltas
  lastSeq(): number; // highest seq applied (catch-up)
  catchUp(): Promise<void>; // apply rows with seq > lastSeq()
  destroy(): void; // flush, unsubscribe
}
export function attachDeckPersistence(
  db: LibraryDb,
  deckId: string,
  doc: DeckDoc,
  options?: {
    flushMs?: number /* 100 */;
    thumbEveryMs?: number /* 2000 */;
    compactAbove?: number /* 200 */;
    onStatus?: (event: SaveEvent) => void;
    now?: () => number;
  },
): DeckPersistence;

export type SaveEvent =
  | { type: 'pending' }
  | { type: 'saved'; at: number }
  | { type: 'failed'; firstUnsavedAt: number; errorName: string };
export const storageOrigin: object; // origin for updates applied from storage
```

Rules: writes only updates whose transaction origin is **not** `storageOrigin` or
`channelOrigin`; each flush writes one merged row + updates `DeckRecord` (`updatedAt`, `name`,
counts, `thumb` when due) in one transaction; `failed` keeps the buffer; `whenLoaded` applies
nothing to the undo history.

## `deck-channel.ts` (Yjs provider)

```ts
export const channelOrigin: object;
export function attachDeckChannel(
  deckId: string,
  doc: DeckDoc,
  options: { persistence: Pick<DeckPersistence, 'catchUp'>; tabId?: string },
): { post(bytes: Uint8Array): void; destroy(): void };
```

Wire protocol on `BroadcastChannel('sododeck:deck:<deckId>')` (same-origin only):

| Message                                 | Sent when                                  | Receiver does                                                        |
| --------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `{ t: 'update', from, bytes }`          | local update (not storage/channel origin)  | `Y.applyUpdate(doc, bytes, channelOrigin)`                           |
| `{ t: 'hello', from, sv, reply: bool }` | on attach (`reply: false`); once in answer | send `diff` for `sv`; if `reply` false, send own `hello{reply:true}` |
| `{ t: 'diff', to, bytes }`              | answering `hello`                          | if `to` is this tab, apply with `channelOrigin`                      |

Fallback (no `BroadcastChannel`): `post` is a no-op; `focus`/`visibilitychange` call `catchUp()`.
Catch-up also runs with a channel present (covers messages missed while the tab was frozen).

## `save-status.ts`

```ts
export type SaveStatus =
  | { kind: 'saved' }
  | { kind: 'saving'; since: number }
  | { kind: 'error'; firstUnsavedAt: number; errorName: string };
export function reduceSaveStatus(state: SaveStatus, event: SaveEvent, now: number): SaveStatus;
export const SAVING_MIN_MS = 200;
export const SAVED_MAX_HOLD_MS = 300;
```

## `deck-summary.ts` (pure)

```ts
export interface DeckSummary {
  name: string;
  nodeCount: number;
  edgeCount: number;
  flowCount: number;
  thumb: DeckThumb | null;
}
export function summarizeDeck(
  file: SododeckFile,
  options?: { maxNodes?: number /* 150 */ },
): DeckSummary;
```

## Library worker (`library-client.ts` ↔ `library.worker.ts` → `library-ops.ts`)

```ts
type Request =
  | { op: 'create'; name: string }
  | { op: 'import'; text: string }
  | { op: 'export'; updates: Uint8Array[] }
  | { op: 'rename'; updates: Uint8Array[]; name: string }
  | { op: 'duplicate'; updates: Uint8Array[]; name: string };

type Result =
  | { op: 'create' | 'import' | 'duplicate'; bytes: Uint8Array; summary: DeckSummary }
  | { op: 'rename'; delta: Uint8Array; summary: DeckSummary }
  | { op: 'export'; json: string; name: string };

type OpError = {
  code: 'invalid-json' | 'invalid-deck' | 'unsupported-version' | 'invalid-name';
  message: string;
};
```

`library-ops.ts` is pure (Node-testable) and uses only `@sododeck/model` / `@sododeck/schema`
(`fromJSON`, `createEditor(...).updateMeta`, `serializeDeck`, `emptySododeckFile`) and `yjs`
(`mergeUpdates`, `encodeStateAsUpdate`, `applyUpdate`). `export` output equals
`serializeDeck(toJSON(doc))` for the same deck.

## `download.ts`, `storage-estimate.ts`, `lib/features.ts`

```ts
export function safeFileName(name: string): string; // + '.sododeck.json' by caller
export function downloadText(fileName: string, text: string, mime?: string): void;

export function readStorageState(): Promise<StorageState>;
export function requestPersistence(): Promise<StorageState>;

// lib/features.ts additions
export function supportsStorageEstimate(): boolean;
export function isQuotaError(error: unknown): boolean;
```
