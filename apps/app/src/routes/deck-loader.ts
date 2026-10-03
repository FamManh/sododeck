import { isLegacyLayout } from '@sododeck/model';
import { redirect, type LoaderFunctionArgs } from 'react-router';
import * as Y from 'yjs';

import { insertDeck, loadDeckLog, type LibraryDb } from '../storage/library-db';
import { getLibraryDb } from '../storage/library-db-instance';
import { create } from '../storage/library-ops';

export type DeckLoaderData =
  | { kind: 'demo' }
  | { kind: 'memory' }
  | { kind: 'not-found' }
  /** Stored by a build before 036 (layout 1): refused, never opened empty (FR-027). */
  | { kind: 'unsupported' }
  | { kind: 'stored'; db: LibraryDb; deckId: string; bytes: Uint8Array[] };

/** Whether stored update bytes hold a deck in the layout used before 036 (R10). */
function isLegacyLog(bytes: readonly Uint8Array[]): boolean {
  const doc = new Y.Doc();
  doc.transact(() => {
    for (const update of bytes) Y.applyUpdate(doc, update);
  });
  const legacy = isLegacyLayout(doc);
  doc.destroy();
  return legacy;
}

/**
 * `/deck/new` creates "Untitled deck" in `?folder=` (or Unfiled) and redirects to it, so the
 * history never keeps `/deck/new`; `/deck/demo` is the in-memory demo; any other id is loaded
 * from the library (contracts/library-ui.md "Routes"). The editor chunk already contains the
 * model, so creating an empty deck runs here rather than in the library worker.
 */
export async function deckLoader({
  params,
  request,
}: LoaderFunctionArgs): Promise<DeckLoaderData | Response> {
  const deckId = params.deckId ?? 'demo';
  if (deckId === 'demo') return { kind: 'demo' };
  const db = await getLibraryDb();
  if (deckId === 'new') {
    if (!db) return { kind: 'memory' };
    const folderParam = new URL(request.url).searchParams.get('folder');
    const folder = folderParam === null ? undefined : await db.folders.get(folderParam);
    const { bytes, summary } = create('Untitled deck');
    const id = crypto.randomUUID();
    const now = Date.now();
    await insertDeck(
      db,
      {
        id,
        folderId: folder && folder.deletedAt === null ? folder.id : null,
        createdAt: now,
        updatedAt: now,
        openedAt: null,
        exportedAt: null,
        deletedAt: null,
        ...summary,
      },
      bytes,
    );
    return redirect(`/deck/${id}`);
  }
  if (!db) return { kind: 'not-found' };
  const log = await loadDeckLog(db, deckId);
  if (!log) return { kind: 'not-found' };
  if (isLegacyLog(log.bytes)) return { kind: 'unsupported' };
  return { kind: 'stored', db, deckId, bytes: log.bytes };
}
