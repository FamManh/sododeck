/**
 * Library actions (US3, US4): each one changes the library database and, for document changes,
 * goes through the library worker so the model stays the only writer of deck content
 * (research R6–R8). UI-free: callers show toasts and move focus.
 */
import { postDeckUpdate } from '../storage/deck-channel-post';
import { downloadText, safeFileName } from '../storage/download';
import {
  FolderNameError,
  insertDeck,
  loadDeckLog,
  markExported,
  moveDeck,
  renameFolder,
  restoreDeck,
  restoreFolder,
  softDeleteDeck,
  softDeleteFolder,
  storeDeckUpdate,
  type LibraryDb,
} from '../storage/library-db';
import { getBlobRow, listBlobIds, putBlob } from '../storage/blob-store';
import type { PictureBytes } from '../storage/library-ops';
import type { LibraryClient } from '../storage/library-client';
import type { DeckSummary } from '../storage/deck-summary';
import type { FolderNameError as FolderNameCode } from '../storage/folder-names';
import { useLibraryStore, type UndoEntry } from './library-store';

export interface LibraryActionContext {
  db: LibraryDb;
  client: LibraryClient;
  now?: () => number;
}

const clock = (ctx: LibraryActionContext) => (ctx.now ?? Date.now)();

async function logOf(ctx: LibraryActionContext, deckId: string) {
  const log = await loadDeckLog(ctx.db, deckId);
  if (!log) throw new Error('Deck not found');
  return log;
}

/**
 * Adds a new deck built by the worker; returns its id. Pictures its file carried are written to
 * the blob store first, so a deck never exists without the bytes of the pictures it shows (055).
 */
export async function addDeck(
  ctx: LibraryActionContext,
  {
    bytes,
    summary,
    pictures = [],
  }: { bytes: Uint8Array; summary: DeckSummary; pictures?: readonly PictureBytes[] },
  folderId: string | null,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = clock(ctx);
  for (const picture of pictures) await putBlob(ctx.db, id, picture.id, picture);
  await insertDeck(
    ctx.db,
    {
      id,
      folderId,
      createdAt: now,
      updatedAt: now,
      openedAt: null,
      exportedAt: null,
      deletedAt: null,
      ...summary,
    },
    bytes,
  );
  return id;
}

/**
 * Renames a deck in its file (FR-017). Empty or unchanged names change nothing; returns whether
 * the name changed. Open editor tabs get the change over the deck channel.
 */
export async function renameDeck(
  ctx: LibraryActionContext,
  deckId: string,
  name: string,
): Promise<boolean> {
  const next = name.trim();
  if (next === '') return false;
  const log = await logOf(ctx, deckId);
  if (log.record.name === next) return false;
  const { delta, summary } = await ctx.client.rename(log.bytes, next);
  await storeDeckUpdate(ctx.db, deckId, delta, { at: clock(ctx), summary });
  postDeckUpdate(deckId, delta);
  return true;
}

/** "<name> copy" in the same folder (FR-018); returns the new deck's id. */
export async function duplicateDeck(ctx: LibraryActionContext, deckId: string): Promise<string> {
  const log = await logOf(ctx, deckId);
  const copy = await ctx.client.duplicate(log.bytes, `${log.record.name} copy`);
  const pictures: PictureBytes[] = [];
  for (const pictureId of await listBlobIds(ctx.db, deckId)) {
    const row = await getBlobRow(ctx.db, deckId, pictureId);
    if (row) pictures.push({ id: row.id, type: row.type, bytes: row.bytes });
  }
  return addDeck(ctx, { ...copy, pictures }, log.record.folderId);
}

export function moveDeckTo(
  ctx: LibraryActionContext,
  deckId: string,
  folderId: string | null,
): Promise<void> {
  return moveDeck(ctx.db, deckId, folderId);
}

/** Soft delete + a session undo entry (research R8). */
export async function deleteDeck(
  ctx: LibraryActionContext,
  deckId: string,
  name: string,
): Promise<void> {
  await softDeleteDeck(ctx.db, deckId, clock(ctx));
  useLibraryStore.getState().pushUndo({ kind: 'deck', id: deckId, name });
}

/** Soft-deletes a folder; its decks go to Unfiled (FR-020). */
export async function deleteFolder(
  ctx: LibraryActionContext,
  folderId: string,
  name: string,
): Promise<void> {
  const { deckIds } = await softDeleteFolder(ctx.db, folderId, clock(ctx));
  useLibraryStore.getState().pushUndo({ kind: 'folder', id: folderId, name, deckIds });
}

export type UndoResult =
  { ok: true; entry: UndoEntry } | { ok: false; entry: UndoEntry; message: string } | null;

/** Undoes the last delete of this session (toast Undo, ⌘Z); `null` when there is none. */
export async function undoLastDelete(ctx: LibraryActionContext): Promise<UndoResult> {
  const entry = useLibraryStore.getState().popUndo();
  if (!entry) return null;
  if (entry.kind === 'deck') {
    await restoreDeck(ctx.db, entry.id);
    return { ok: true, entry };
  }
  try {
    await restoreFolder(ctx.db, entry.id, entry.deckIds);
    return { ok: true, entry };
  } catch (error) {
    if (error instanceof FolderNameError) {
      return {
        ok: false,
        entry,
        message: `Couldn't restore "${entry.name}": a folder with that name exists.`,
      };
    }
    throw error;
  }
}

/** Inline folder rename; returns the validation error, or `null` when saved. */
export async function renameFolderInline(
  ctx: LibraryActionContext,
  folderId: string,
  name: string,
): Promise<FolderNameCode | null> {
  try {
    await renameFolder(ctx.db, folderId, name);
    return null;
  } catch (error) {
    if (error instanceof FolderNameError) return error.code;
    throw error;
  }
}

/** Downloads `<name>.sododeck.json`, the model's export of the stored deck (FR-025, FR-027). */
export async function exportDeckFile(ctx: LibraryActionContext, deckId: string): Promise<void> {
  const log = await logOf(ctx, deckId);
  const pictures = new Map<string, Uint8Array>();
  for (const pictureId of await listBlobIds(ctx.db, deckId)) {
    const row = await getBlobRow(ctx.db, deckId, pictureId);
    if (row) pictures.set(row.id, row.bytes);
  }
  const { json, name } = await ctx.client.exportDeck(log.bytes, pictures);
  downloadText(`${safeFileName(name)}.sododeck.json`, json);
  await markExported(ctx.db, deckId, clock(ctx));
}

/**
 * Imports one file as a new deck (FR-023); returns its name and how many pictures the file could
 * not supply (they open as "Picture missing", 055). Worker errors propagate.
 */
export async function importDeckFile(
  ctx: LibraryActionContext,
  text: string,
  folderId: string | null,
): Promise<{ name: string; missingPictures: number }> {
  const imported = await ctx.client.importFile(text);
  await addDeck(ctx, imported, folderId);
  return { name: imported.summary.name, missingPictures: imported.problems.length };
}

/** The import toast: names the deck and, once, how many pictures are missing (055). */
export function importedMessage(name: string, missingPictures: number, suffix = ''): string {
  const base = `Imported "${name}"${suffix}`;
  if (missingPictures === 0) return base;
  const noun = missingPictures === 1 ? 'picture is' : 'pictures are';
  return `${base}. ${String(missingPictures)} ${noun} missing from the file.`;
}
