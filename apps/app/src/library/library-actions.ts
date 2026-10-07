/**
 * Library actions (US3, US4): each one changes the library database and, for document changes,
 * goes through the library worker so the model stays the only writer of deck content
 * (research R6–R8). UI-free: callers show toasts and move focus.
 */
import type { ProblemReport } from '@sododeck/model';

import { postDeckUpdate } from '../storage/deck-channel-post';
import { deckFileName, downloadText } from '../storage/download';
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
import { applyLayout, toLayoutRequest } from '../import-mermaid/layout-input';
import type { ImportReport } from '../import-mermaid/import-report';
import { getLayoutClient, type LayoutClient } from '../layout/layout-client';
import { placeUnplaced } from '../layout/place-unplaced';
import type { LibraryClient } from '../storage/library-client';
import type { DeckSummary } from '../storage/deck-summary';
import type { FolderNameError as FolderNameCode } from '../storage/folder-names';
import { importedMessage, problemCount } from './import-messages';
import { useLibraryStore, type UndoEntry } from './library-store';

export interface LibraryActionContext {
  db: LibraryDb;
  client: LibraryClient;
  /** The ELK layout worker; the shared one when absent (tests pass a fake). */
  layout?: Pick<LayoutClient, 'layout'>;
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

/** Downloads `<name>.sododeck`, the model's export of the stored deck (FR-025, FR-027). */
export async function exportDeckFile(ctx: LibraryActionContext, deckId: string): Promise<void> {
  const log = await logOf(ctx, deckId);
  const pictures = new Map<string, Uint8Array>();
  for (const pictureId of await listBlobIds(ctx.db, deckId)) {
    const row = await getBlobRow(ctx.db, deckId, pictureId);
    if (row) pictures.set(row.id, row.bytes);
  }
  const { json, name } = await ctx.client.exportDeck(log.bytes, pictures);
  downloadText(deckFileName(name), json);
  await markExported(ctx.db, deckId, clock(ctx));
}

/**
 * Imports one file as a new deck (FR-023); returns its id, its name and the report of what the
 * opened deck should tell the user (062 US2: damaged pictures, problems), `null` when clean.
 * `fileName` names the file in the reports. Worker errors propagate; a refused file's error
 * carries its report.
 */
export async function importDeckFile(
  ctx: LibraryActionContext,
  text: string,
  folderId: string | null,
  fileName?: string,
): Promise<{ deckId: string; name: string; report: ProblemReport | null }> {
  const imported = await ctx.client.importFile(text, fileName);
  // Cards without a position (the AI deck skill leaves them out, 027 FR-024) are placed by the
  // layout worker first, placed cards pinned; the report stays the one of the user's own file.
  const stored =
    imported.unplaced === undefined
      ? imported
      : await ctx.client.importFile(
          JSON.stringify(
            await placeUnplaced(imported.unplaced, (request) =>
              (ctx.layout ?? getLayoutClient()).layout(request),
            ),
          ),
          fileName,
        );
  const deckId = await addDeck(ctx, stored, folderId);
  return { deckId, name: stored.summary.name, report: imported.openReport };
}

// The pure wording lives in import-messages.ts (storage-free); re-exported for existing callers.
export { importedMessage, problemCount };

export interface MermaidImportResult {
  deckId: string;
  name: string;
  report: ImportReport;
}

/**
 * Imports Mermaid text as a new deck (056): the worker reads it, the layout worker places a
 * flowchart, and the result goes through the ordinary file import, so validation, ids and storage
 * are the ones every import uses. Any failure (a refused text, a failed or cancelled layout)
 * throws before anything is stored.
 */
export async function importMermaidDeck(
  ctx: LibraryActionContext,
  text: string,
  folderId: string | null,
): Promise<MermaidImportResult> {
  const { file, report, direction } = await ctx.client.importMermaid(text);
  const placed =
    direction === null
      ? file
      : applyLayout(
          file,
          await (ctx.layout ?? getLayoutClient()).layout(toLayoutRequest(file, direction)),
        );
  const imported = await ctx.client.importFile(JSON.stringify(placed));
  const deckId = await addDeck(ctx, imported, folderId);
  return { deckId, name: imported.summary.name, report };
}
