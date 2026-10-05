/**
 * Library operations that need the deck model (research R7). Pure functions over Yjs update
 * bytes: the library worker runs them so the library route never loads Yjs or the model, and
 * tests call them directly. Deck content goes in and out only through `@sododeck/model`.
 */
import {
  createEditor,
  DeckValidationError,
  fromJSON,
  loadDeck,
  NEW_DECK_PACKS,
  isLegacyLayout,
  serializeDeck,
  toJSON,
  type AssetProblem,
  type TrimmedCrop,
  type DeckDoc,
} from '@sododeck/model';
import { emptySododeckFile, FORMAT_VERSION, type SododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

import { importMermaidText, type MermaidImport } from '../import-mermaid/import-mermaid';
import { MermaidImportError } from '../import-mermaid/import-report';
import { summarizeDeck, type DeckSummary } from './deck-summary';
import { UNSUPPORTED_DECK_MESSAGE } from './library-ops-messages';

export type LibraryOpErrorCode =
  | 'invalid-json'
  | 'invalid-deck'
  | 'unsupported-version'
  | 'invalid-name'
  | 'unsupported-deck'
  // Mermaid import (056): the message carries the detail (keyword, first problem, limit).
  | 'mermaid-empty'
  | 'mermaid-unsupported-type'
  | 'mermaid-nothing-readable'
  | 'mermaid-too-large';

export class LibraryOpError extends Error {
  constructor(
    readonly code: LibraryOpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LibraryOpError';
  }
}

export interface DeckBytes {
  bytes: Uint8Array;
  summary: DeckSummary;
}

/** One picture's bytes, ready for the blob store (055 R4). */
export interface PictureBytes {
  id: string;
  type: string;
  bytes: Uint8Array;
}

/** An imported deck: the document plus the pictures its file carried and any it could not use. */
export interface ImportedDeck extends DeckBytes {
  pictures: PictureBytes[];
  problems: AssetProblem[];
  /** Images whose crop ran past the picture edge and was cut back on load (057). */
  trimmedCrops: TrimmedCrop[];
}

const IMPORTED_NAME = 'Imported deck';

/**
 * The stored deck as a document. A deck in the layout used before 036 would read as an empty deck,
 * so it is refused instead (`unsupported-deck`): nothing is written (036 R10).
 */
function load(updates: readonly Uint8Array[]): DeckDoc {
  const doc = new Y.Doc();
  doc.transact(() => {
    for (const update of updates) Y.applyUpdate(doc, update);
  });
  if (isLegacyLayout(doc)) throw new LibraryOpError('unsupported-deck', UNSUPPORTED_DECK_MESSAGE);
  return doc;
}

function fromFile(file: SododeckFile): DeckBytes {
  const doc = fromJSON(file);
  return { bytes: Y.encodeStateAsUpdate(doc), summary: summarizeDeck(toJSON(doc)) };
}

/** The sound pictures of a loaded file, typed from the document's asset list. */
function picturesOf(doc: DeckDoc, bytes: ReadonlyMap<string, Uint8Array>): PictureBytes[] {
  const assets = toJSON(doc).assets ?? {};
  const pictures: PictureBytes[] = [];
  for (const [id, data] of bytes) {
    const meta = assets[id];
    if (meta !== undefined) pictures.push({ id, type: meta.type, bytes: data });
  }
  return pictures;
}

function checkName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '') throw new LibraryOpError('invalid-name', 'A deck name cannot be empty.');
  return trimmed;
}

/** A new, empty deck with every pack on (030); imports keep the packs their file has. */
export function create(name: string): DeckBytes {
  return fromFile({ ...emptySododeckFile(), name: checkName(name), packs: [...NEW_DECK_PACKS] });
}

/** Parses and validates one `.sododeck.json` file (FR-023, FR-024). */
export function importFile(text: string): ImportedDeck {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new LibraryOpError('invalid-json', 'The file is not JSON.');
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'version' in parsed &&
    typeof parsed.version === 'number' &&
    parsed.version > FORMAT_VERSION
  ) {
    throw new LibraryOpError('unsupported-version', 'The file format is newer than this app.');
  }
  let doc: DeckDoc;
  let loaded: ReturnType<typeof loadDeck>;
  try {
    loaded = loadDeck(parsed);
    doc = loaded.doc;
  } catch (error) {
    if (error instanceof DeckValidationError) {
      throw new LibraryOpError('invalid-deck', 'The file is not a valid deck.');
    }
    throw error;
  }
  // A library deck always has a name; a nameless file gets one (and keeps it on export).
  if (toJSON(doc).name === undefined) createEditor(doc).updateMeta({ name: IMPORTED_NAME });
  return {
    bytes: Y.encodeStateAsUpdate(doc),
    summary: summarizeDeck(toJSON(doc)),
    pictures: picturesOf(doc, loaded.bytes),
    problems: loaded.problems,
    trimmedCrops: loaded.trimmedCrops,
  };
}

/**
 * Reads Mermaid text into a deck file plus a report (056). A flowchart comes back without
 * positions (`direction` set); the caller lays it out and stores it through `importFile`. A
 * refusal throws `LibraryOpError` (`mermaid-*`) and creates nothing.
 */
export function importMermaid(text: string): MermaidImport {
  try {
    return importMermaidText(text);
  } catch (error) {
    if (error instanceof MermaidImportError) {
      throw new LibraryOpError(`mermaid-${error.code}`, error.detail);
    }
    throw error;
  }
}

/**
 * The model's export of a stored deck (FR-025). `pictures` are the deck's blob rows: the file
 * embeds those its images use, and a picture with no bytes is written as missing (055).
 */
export function exportDeck(
  updates: readonly Uint8Array[],
  pictures: ReadonlyMap<string, Uint8Array> = new Map(),
): { json: string; name: string } {
  const file = toJSON(load(updates));
  return { json: serializeDeck(file, pictures), name: file.name ?? 'Untitled deck' };
}

/** Renames through the model (research R6); returns only the change, to append to the log. */
export function rename(
  updates: readonly Uint8Array[],
  name: string,
): { delta: Uint8Array; summary: DeckSummary } {
  const next = checkName(name);
  const doc = load(updates);
  const before = Y.encodeStateVector(doc);
  const editor = createEditor(doc, { repair: false });
  editor.updateMeta({ name: next });
  editor.destroy();
  return { delta: Y.encodeStateAsUpdate(doc, before), summary: summarizeDeck(toJSON(doc)) };
}

/** An independent copy (new Yjs history) with a new name (FR-018). */
export function duplicate(updates: readonly Uint8Array[], name: string): DeckBytes {
  return fromFile({ ...toJSON(load(updates)), name: checkName(name) });
}
