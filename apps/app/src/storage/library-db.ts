import { Dexie, type EntityTable } from 'dexie';

import { removeShellPrefs } from '../editor/shell/shell-prefs';
import { supportsIndexedDB } from '../lib/features';
import { folderNameKey, validateFolderName, type FolderNameError as Code } from './folder-names';

/**
 * The local deck library (data-model.md, ADR 0007): one Dexie database with the library records
 * (`decks`, `folders`) and the deck contents as an append-only log of Yjs updates (`updates`).
 * A record's `name`, counts and `thumb` are caches of the document, written with each update in
 * the same transaction and never read back into the document (constitution I).
 */

/**
 * A thumbnail summary normalized to a 0–1000 box, aspect ratio kept (research R10): the box
 * size, the node size, node top-left corners with their type, and group boxes. A resized card
 * (017 R13) carries its own `w, h`; otherwise the thumbnail draws it at the default `node` size.
 */
export interface DeckThumb {
  w: number;
  h: number;
  node: [w: number, h: number];
  nodes: [x: number, y: number, type: string, w?: number, h?: number][];
  groups: [x: number, y: number, w: number, h: number][];
}

export interface DeckRecord {
  id: string;
  /** `null` = Unfiled. */
  folderId: string | null;
  name: string;
  createdAt: number;
  /** Last write that carried an edit (never a load or another tab's relayed update). */
  updatedAt: number;
  openedAt: number | null;
  exportedAt: number | null;
  /** Soft delete; purged on the next app start. */
  deletedAt: number | null;
  nodeCount: number;
  edgeCount: number;
  flowCount: number;
  thumb: DeckThumb | null;
}

export interface FolderRecord {
  id: string;
  name: string;
  /** `folderNameKey(name)`, unique; rewritten while the folder is soft-deleted. */
  nameKey: string;
  createdAt: number;
  deletedAt: number | null;
}

/**
 * One stored picture (055 R4). `id` is the SHA-256 of `bytes`, so a row never changes and cannot
 * drift from the document. Bytes live here, outside Yjs, so autosave and sync stay small.
 */
export interface BlobRow {
  deckId: string;
  id: string;
  /** One of the six allowed picture types (e.g. `image/png`). */
  type: string;
  bytes: Uint8Array;
}

export interface UpdateRow {
  seq: number;
  deckId: string;
  bytes: Uint8Array;
}

/** The cache fields written from the document with each update. `thumb` only when due. */
export interface DeckCache {
  name: string;
  nodeCount: number;
  edgeCount: number;
  flowCount: number;
  thumb?: DeckThumb | null;
}

export class FolderNameError extends Error {
  constructor(readonly code: Code) {
    super(`Invalid folder name (${code})`);
    this.name = 'FolderNameError';
  }
}

export class LibraryDb extends Dexie {
  decks!: EntityTable<DeckRecord, 'id'>;
  folders!: EntityTable<FolderRecord, 'id'>;
  updates!: EntityTable<UpdateRow, 'seq'>;
  blobs!: Dexie.Table<BlobRow, [string, string]>;

  constructor(name = 'sododeck-library') {
    super(name);
    // v1 was declared by M0 but never written by a release.
    this.version(1).stores({ decks: 'id, name, updatedAt' });
    this.version(2)
      .stores({
        decks: 'id, folderId, updatedAt, openedAt, deletedAt',
        folders: 'id, &nameKey, deletedAt',
        updates: '++seq, deckId, [deckId+seq]',
      })
      .upgrade((tx) =>
        tx
          .table<Partial<DeckRecord> & { id: string }>('decks')
          .toCollection()
          .modify((deck) => {
            deck.folderId ??= null;
            deck.openedAt ??= null;
            deck.exportedAt ??= null;
            deck.deletedAt ??= null;
            deck.nodeCount ??= 0;
            deck.edgeCount ??= 0;
            deck.flowCount ??= 0;
            deck.thumb ??= null;
          }),
      );
    // v3 (055): pictures, keyed per deck so duplicate and delete are row copies and deletes.
    this.version(3).stores({ blobs: '[deckId+id], deckId' });
  }
}

/** Opens the library, or `null` when this browser cannot keep it (research R15). */
export async function openLibraryDb(name?: string): Promise<LibraryDb | null> {
  if (!supportsIndexedDB()) return null;
  const db = new LibraryDb(name);
  try {
    await db.open();
    return db;
  } catch {
    return null;
  }
}

// ── Decks ──

export async function insertDeck(
  db: LibraryDb,
  record: DeckRecord,
  bytes: Uint8Array,
): Promise<void> {
  await db.transaction('rw', db.decks, db.updates, async () => {
    await db.decks.add(record);
    await db.updates.add({ deckId: record.id, bytes });
  });
}

/**
 * Appends one update to a deck's log and refreshes its cached fields, in one transaction.
 * Returns the new row's `seq`. Throws (e.g. a quota error) without writing anything.
 */
export async function storeDeckUpdate(
  db: LibraryDb,
  deckId: string,
  bytes: Uint8Array,
  { at, summary }: { at: number; summary: DeckCache },
): Promise<number> {
  return db.transaction('rw', db.decks, db.updates, async () => {
    const seq = await db.updates.add({ deckId, bytes });
    const { thumb, ...fields } = summary;
    await db.decks.update(deckId, {
      ...fields,
      ...(thumb === undefined ? {} : { thumb }),
      updatedAt: at,
    });
    return seq;
  });
}

export async function moveDeck(db: LibraryDb, id: string, folderId: string | null): Promise<void> {
  await db.decks.update(id, { folderId });
}

/** Recent (FR-014): library information only, not an edit. */
export async function markOpened(db: LibraryDb, id: string, at = Date.now()): Promise<void> {
  await db.decks.update(id, { openedAt: at });
}

export async function markExported(db: LibraryDb, id: string, at = Date.now()): Promise<void> {
  await db.decks.update(id, { exportedAt: at });
}

export async function softDeleteDeck(db: LibraryDb, id: string, at = Date.now()): Promise<void> {
  await db.decks.update(id, { deletedAt: at });
}

export async function restoreDeck(db: LibraryDb, id: string): Promise<void> {
  await db.decks.update(id, { deletedAt: null });
}

/** A live deck's record and its update log in `seq` order; `null` if unknown or deleted. */
export async function loadDeckLog(
  db: LibraryDb,
  id: string,
): Promise<{ record: DeckRecord; bytes: Uint8Array[]; maxSeq: number } | null> {
  return db.transaction('r', db.decks, db.updates, async () => {
    const record = await db.decks.get(id);
    if (!record || record.deletedAt !== null) return null;
    const rows = await deckRows(db, id, 0);
    return { record, bytes: rows.map((r) => r.bytes), maxSeq: rows.at(-1)?.seq ?? 0 };
  });
}

/** A deck's update rows with `seq > after`, in `seq` order. */
export function deckRows(db: LibraryDb, deckId: string, after: number): Promise<UpdateRow[]> {
  return db.updates
    .where('[deckId+seq]')
    .between([deckId, after + 1], [deckId, Dexie.maxKey])
    .toArray();
}

/** Every live deck (the library views filter and sort them, library-view.ts). */
export function liveDecks(db: LibraryDb): Promise<DeckRecord[]> {
  return db.decks.filter((d) => d.deletedAt === null).toArray();
}

// ── Folders ──

/** Live folders by name. */
export async function liveFolders(db: LibraryDb): Promise<FolderRecord[]> {
  const folders = await db.folders.filter((f) => f.deletedAt === null).toArray();
  return folders.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

async function liveKeys(db: LibraryDb, except?: string): Promise<string[]> {
  const folders = await db.folders.filter((f) => f.deletedAt === null && f.id !== except).toArray();
  return folders.map((f) => f.nameKey);
}

function check(name: string, keys: string[]): void {
  const error = validateFolderName(name, keys);
  if (error !== null) throw new FolderNameError(error);
}

export async function createFolder(
  db: LibraryDb,
  name: string,
  at = Date.now(),
): Promise<FolderRecord> {
  return db.transaction('rw', db.folders, async () => {
    check(name, await liveKeys(db));
    const trimmed = name.trim();
    const folder: FolderRecord = {
      id: crypto.randomUUID(),
      name: trimmed,
      nameKey: folderNameKey(trimmed),
      createdAt: at,
      deletedAt: null,
    };
    await db.folders.add(folder);
    return folder;
  });
}

export async function renameFolder(db: LibraryDb, id: string, name: string): Promise<void> {
  await db.transaction('rw', db.folders, async () => {
    check(name, await liveKeys(db, id));
    const trimmed = name.trim();
    await db.folders.update(id, { name: trimmed, nameKey: folderNameKey(trimmed) });
  });
}

/** Soft-deletes a folder and moves its decks to Unfiled; returns them for Undo. */
export async function softDeleteFolder(
  db: LibraryDb,
  id: string,
  at = Date.now(),
): Promise<{ deckIds: string[] }> {
  return db.transaction('rw', db.folders, db.decks, async () => {
    const folder = await db.folders.get(id);
    if (!folder || folder.deletedAt !== null) return { deckIds: [] };
    const decks = await db.decks.where('folderId').equals(id).primaryKeys();
    await db.decks.where('folderId').equals(id).modify({ folderId: null });
    // Frees the unique name while the folder waits for Undo or purge.
    await db.folders.update(id, { deletedAt: at, nameKey: `${folder.nameKey}\u0000${id}` });
    return { deckIds: decks };
  });
}

/**
 * Undo of a folder delete: the folder comes back and its decks return to it if they are still
 * Unfiled. Throws `FolderNameError('duplicate')` if another folder took the name meanwhile.
 */
export async function restoreFolder(db: LibraryDb, id: string, deckIds: string[]): Promise<void> {
  await db.transaction('rw', db.folders, db.decks, async () => {
    const folder = await db.folders.get(id);
    if (!folder) return;
    check(folder.name, await liveKeys(db, id));
    await db.folders.update(id, { deletedAt: null, nameKey: folderNameKey(folder.name) });
    await db.decks
      .where('id')
      .anyOf(deckIds)
      .filter((d) => d.folderId === null)
      .modify({ folderId: id });
  });
}

/** Makes deletes final (called once per app start): records, their updates, folders. */
export async function purgeDeleted(db: LibraryDb): Promise<void> {
  const purged = await db.transaction(
    'rw',
    db.decks,
    db.updates,
    db.folders,
    db.blobs,
    async () => {
      const decks = await db.decks.filter((d) => d.deletedAt !== null).primaryKeys();
      if (decks.length > 0) {
        await db.updates.where('deckId').anyOf(decks).delete();
        await db.blobs.where('deckId').anyOf(decks).delete();
        await db.decks.bulkDelete(decks);
      }
      await db.folders.filter((f) => f.deletedAt !== null).delete();
      return decks;
    },
  );
  // UI preferences of a deck (018) must not outlive it.
  for (const id of purged) removeShellPrefs(id);
}
