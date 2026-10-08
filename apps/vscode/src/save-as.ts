import {
  assetId,
  createEditor,
  inspectDeckText,
  loadDeck,
  serializeDeck,
  sniffType,
} from '@sododeck/model';

import type { DeckDocument } from './deck-document';
import type { Flushable } from './document-ops';
import { encode, kindOf } from './file-codec';
import { writeDeckFile } from './file-writer';
import { storePicture } from './picture-host';
import type { Loc, Ports } from './ports';
import { resolveInside } from './workspace-guard';

/**
 * The deck text with some pictures' `path` changed, through the model, so nothing else in the
 * canonical text moves (Principle II). Throws only if the model refuses the text.
 */
export function rewritePicturePaths(text: string, paths: ReadonlyMap<string, string>): string {
  if (paths.size === 0) return text;
  const loaded = loadDeck(JSON.parse(text));
  const editor = createEditor(loaded.doc);
  for (const [id, path] of paths) editor.setPicturePath(id, path);
  return serializeDeck(loaded.doc, loaded.bytes);
}

/**
 * Copies the picture files the deck points at next to the new deck and returns the new paths
 * (FR-017a). A picture that cannot be copied (missing, outside the workspace, changed, not
 * trusted) keeps its path; the old deck and its files are never touched.
 */
async function copyPictures(
  text: string,
  from: Loc,
  to: Loc,
  ports: Ports,
): Promise<Map<string, string>> {
  const moved = new Map<string, string>();
  const inspected = inspectDeckText(text);
  if (!inspected.ok || !ports.trust.isTrusted()) return moved;
  for (const ref of inspected.loaded.fileRefs) {
    const source = await resolveInside(from, ref.path, ports);
    if (!source.ok) continue;
    let bytes: Uint8Array;
    try {
      bytes = await ports.files.read(source.loc);
    } catch {
      continue;
    }
    const mime = sniffType(bytes);
    if (mime === null || assetId(bytes) !== ref.id) continue;
    const stored = await storePicture(to, { id: ref.id, mime, bytes }, ports);
    if (stored.ok) moved.set(ref.id, stored.path);
  }
  return moved;
}

/**
 * Save As (FR-017a): flush, copy pictures next to the new deck, write the new file. The
 * destination's name picks the form (R7), so Save As converts between `.sododeck` and a note.
 */
export async function saveDocumentAs(
  doc: DeckDocument,
  session: Flushable | null,
  destination: Loc,
  ports: Ports,
): Promise<void> {
  await session?.flush();
  const text = doc.text;
  const moved = await copyPictures(text, doc.loc, destination, ports);
  const rewritten = rewritePicturePaths(text, moved);
  await writeDeckFile(ports.files, destination, encode(kindOf(destination), rewritten));
}
