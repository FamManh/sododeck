# Data Model: Local Deck Library and Autosave

No change to the `.sododeck.json` format or to `@sododeck/model`. Everything below is **library
information** stored in the browser (IndexedDB via Dexie, database `sododeck-library`) or UI-only
state. Deck content is only the Yjs update log (constitution I); the other fields are metadata or
derived caches.

## Dexie schema v2

```ts
this.version(2).stores({
  decks: 'id, folderId, updatedAt, openedAt, deletedAt',
  folders: 'id, &nameKey, deletedAt',
  updates: '++seq, deckId, [deckId+seq]',
});
```

v1 (`decks: 'id, name, updatedAt'`) was never written by any release, so the upgrade needs no data
migration; the `upgrade()` callback fills defaults for any row found (`folderId: null`,
`deletedAt: null`, counts 0, `thumb: null`).

### `decks` — `DeckRecord`

| Field        | Type                | Rules                                                                                 |
| ------------ | ------------------- | ------------------------------------------------------------------------------------- |
| `id`         | `string`            | `crypto.randomUUID()`; library identity, **not** in the file; never changes           |
| `folderId`   | `string \| null`    | `null` = Unfiled; must reference a non-deleted folder or be `null`                    |
| `name`       | `string`            | **cache** of the doc's `name` (`'Untitled deck'` when absent); written on every flush |
| `createdAt`  | `number` (epoch ms) | set once                                                                              |
| `updatedAt`  | `number`            | last flush that carried a local/library edit (not loads, not relayed updates)         |
| `openedAt`   | `number \| null`    | set when the editor opens the deck; drives Recent                                     |
| `exportedAt` | `number \| null`    | last single-deck export (FR-027)                                                      |
| `deletedAt`  | `number \| null`    | soft delete; purged on next app start                                                 |
| `nodeCount`  | `number`            | cache; "components" on the card                                                       |
| `edgeCount`  | `number`            | cache                                                                                 |
| `flowCount`  | `number`            | cache                                                                                 |
| `thumb`      | `DeckThumb \| null` | cache, rewritten at most every 2 s                                                    |

`DeckThumb = { nodes: [x: number, y: number, kind: NodeKind][]; groups: [x, y, w, h][] }`, all
coordinates normalized to a 0–1000 box preserving aspect ratio; ≤ 150 nodes.

### `folders` — `FolderRecord`

| Field       | Type             | Rules                                                                                                                                                                                                |
| ----------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | `string`         | random UUID                                                                                                                                                                                          |
| `name`      | `string`         | trimmed display name, 1–60 chars                                                                                                                                                                     |
| `nameKey`   | `string`         | `name.trim().toLocaleLowerCase('en')`; unique index enforces FR-019 (case-insensitive, trimmed)                                                                                                      |
| `createdAt` | `number`         |                                                                                                                                                                                                      |
| `deletedAt` | `number \| null` | soft delete; while set, the unique `nameKey` is rewritten to `nameKey + '\u0000' + id` so a new folder can reuse the name, and restored on undo (fails with a toast if the name was taken meanwhile) |

Folder validation (`folder-names.ts`, pure): `empty` when trimmed name is `''`; `duplicate` when
another non-deleted folder has the same `nameKey`; `too-long` > 60 chars. Messages: "Enter a folder
name." / "A folder named "X" already exists."

### `updates` — `UpdateRow`

| Field    | Type         | Rules                                                         |
| -------- | ------------ | ------------------------------------------------------------- |
| `seq`    | auto number  | global, monotonically increasing; used for cross-tab catch-up |
| `deckId` | `string`     | owning deck                                                   |
| `bytes`  | `Uint8Array` | one Yjs update (merged batch, or the compacted state)         |

Invariants: loading all rows of a deck in `seq` order into an empty `Y.Doc` gives the deck;
compaction replaces rows ≤ `maxSeq` with one merged row in one transaction; hard delete removes all
rows of the deck with its record.

## UI-only state (Zustand, never persisted as document data)

- **`saveStatus`** (per open deck): see state machine below.
- **Library store**: `section` (`all | recent | samples | folder:<id>`), `search`, `viewMode`
  (`grid | list`, mirrored to `localStorage["sododeck.library.view"]`), `undoStack` of
  `{ kind: 'deck'; id } | { kind: 'folder'; id; deckIds: string[] }` (session only), `renaming` id.
- **Storage card**: `{ supported, usage?, quota?, persisted: 'on' | 'off' | 'declined' | 'unsupported' }`.

## State machines

### Save status (per open deck)

```text
            buffered local update
  saved ─────────────────────────────▶ saving
    ▲                                    │
    │ flush resolved (after ≥200 ms      │ flush rejected
    │ display, ≤300 ms after resolve)    ▼
    └──────────── flush resolved ◀──── error{firstUnsavedAt, errorName}
                                         │  ▲
                                         └──┘ new edit / ⌘S / Retry → retry flush
```

Loads, catch-up reads and channel updates never change the status. In `error`, updates stay in
the in-memory buffer; Export uses the live doc.

### Deck lifecycle

```text
 (create | import | duplicate) ──▶ active ──(confirm delete)──▶ deleted(soft)
                                     ▲                               │
                                     └──── Undo / ⌘Z (same session) ─┘
                                             app start ──▶ purged (rows + record removed)
```

### Folder lifecycle

`active → deleted(soft, decks moved to Unfiled, deckIds remembered) → Undo restores folder and moves
those decks back (if they are still Unfiled) → app start purges`.

## Derived views (pure, `library-view.ts`)

- **All decks**: non-deleted decks, `updatedAt` desc.
- **Folder**: non-deleted decks with `folderId`, `updatedAt` desc.
- **Recent**: non-deleted decks with `openedAt`, `openedAt` desc, first 8.
- **Samples**: empty until 013.
- **Search**: current section filtered by `name.toLocaleLowerCase('en').includes(query.trim().toLocaleLowerCase('en'))`.
- **Header count**: `"<n> deck(s) · stored in this browser"`.
