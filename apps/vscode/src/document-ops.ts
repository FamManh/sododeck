import { DeckDocument } from './deck-document';
import { writeDeckFile } from './file-writer';
import type { FilePort, Loc } from './ports';

const decoder = new TextDecoder();

/** The part of a session that save needs; absent when no canvas is open for the document. */
export interface Flushable {
  flush(): Promise<void>;
  sendExternalChange(text: string): void;
}

async function readText(files: FilePort, loc: Loc): Promise<string | undefined> {
  try {
    return decoder.decode(await files.read(loc));
  } catch {
    return undefined;
  }
}

/**
 * Opens the document (R7): from the file, or from a hot-exit backup (dirty against what the disk
 * holds now). A missing backup falls back to the disk text; a missing file opens empty, which
 * the host shows as an empty deck and saves like any new file.
 */
export async function openDocument(files: FilePort, loc: Loc, backup?: Loc): Promise<DeckDocument> {
  const disk = (await readText(files, loc)) ?? '';
  if (backup !== undefined) {
    const backupText = await readText(files, backup);
    if (backupText !== undefined) return DeckDocument.fromBackup(loc, backupText, disk);
  }
  return DeckDocument.fromDisk(loc, disk);
}

/**
 * Save (FR-007, FR-010): ask the canvas for anything pending, then write the canvas's last text
 * byte for byte. A clean document writes nothing. The only place besides save as and the new-deck
 * command that writes the deck file.
 */
export async function saveDocument(
  files: FilePort,
  doc: DeckDocument,
  session: Flushable | null,
): Promise<void> {
  await session?.flush();
  if (!doc.dirty) return;
  const text = doc.text;
  await writeDeckFile(files, doc.loc, text);
  doc.markSaved(text);
}

/** Revert: the disk wins; the canvas shows it and the document is clean. */
export async function revertDocument(
  files: FilePort,
  doc: DeckDocument,
  session: Flushable | null,
): Promise<void> {
  const disk = await readText(files, doc.loc);
  if (disk === undefined) {
    // Nothing to revert to: keep what the user has; a save will recreate the file.
    return;
  }
  doc.revertTo(disk);
  session?.sendExternalChange(disk);
}

/** Hot exit (R7): the current text goes to the destination VS Code chose. */
export async function backupDocument(
  files: FilePort,
  doc: DeckDocument,
  destination: Loc,
): Promise<void> {
  await files.write(destination, new TextEncoder().encode(doc.text));
}
