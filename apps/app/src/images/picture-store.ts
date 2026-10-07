import { createContext, useContext } from 'react';

import { getBlobRow, listBlobIds, putBlob } from '../storage/blob-store';
import type { LibraryDb } from '../storage/library-db';

/** One stored picture: its detected type and its (already compressed) bytes. */
export interface StoredPicture {
  type: string;
  bytes: Uint8Array;
  /** The file name the picture came with, when the store hands it on (a host names its file). */
  name?: string;
}

/**
 * Where the open deck's picture bytes live (055 R4). The document never holds them: images name a
 * picture by content hash and this store resolves it. A stored deck uses its rows in the library
 * database; a deck without storage (the demo, a browser that cannot keep decks) keeps them in
 * memory for the session.
 */
export interface PictureStore {
  /** Identifies the store and deck, so views of one picture share one object URL. */
  readonly key: string;
  /** Writes a picture once; an existing id is kept (same id means same bytes). */
  put(id: string, picture: StoredPicture): Promise<void>;
  /** The picture as a `Blob`, or `null` when there is no row for it. */
  get(id: string): Promise<Blob | null>;
  /** The stored bytes, for file export. */
  getBytes(id: string): Promise<StoredPicture | null>;
  /** Every stored picture id of the deck. */
  ids(): Promise<string[]>;
  /**
   * The store can fetch a picture the deck saved as a file next to it (068), by its id: the
   * embed's host-backed store. Absent: such a picture is shown as missing.
   */
  readonly readsFilePaths?: boolean;
  /** Why a picture is missing, when the store knows (the host's own words). */
  missingReason?(id: string): string | undefined;
}

export function dbPictureStore(db: LibraryDb, deckId: string): PictureStore {
  return {
    key: `db:${deckId}`,
    put: (id, picture) => putBlob(db, deckId, id, picture),
    async get(id) {
      const row = await getBlobRow(db, deckId, id);
      return row ? new Blob([row.bytes as Uint8Array<ArrayBuffer>], { type: row.type }) : null;
    },
    async getBytes(id) {
      const row = await getBlobRow(db, deckId, id);
      return row ? { type: row.type, bytes: row.bytes } : null;
    },
    ids: () => listBlobIds(db, deckId),
  };
}

let memoryStores = 0;

export function memoryPictureStore(): PictureStore {
  const rows = new Map<string, StoredPicture>();
  memoryStores += 1;
  return {
    key: `memory:${String(memoryStores)}`,
    put(id, picture) {
      if (!rows.has(id)) rows.set(id, picture);
      return Promise.resolve();
    },
    get(id) {
      const row = rows.get(id);
      return Promise.resolve(
        row ? new Blob([row.bytes as Uint8Array<ArrayBuffer>], { type: row.type }) : null,
      );
    },
    getBytes: (id) => Promise.resolve(rows.get(id) ?? null),
    ids: () => Promise.resolve([...rows.keys()]),
  };
}

/** Provided by the editor shell around one open deck. */
export const PictureStoreContext = createContext<PictureStore | null>(null);

export function usePictureStore(): PictureStore | null {
  return useContext(PictureStoreContext);
}
