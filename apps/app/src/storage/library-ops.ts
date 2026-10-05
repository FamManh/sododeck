/**
 * Library operations that need the deck model (research R7). Pure functions over Yjs update
 * bytes: the library worker runs them so the library route never loads Yjs or the model, and
 * tests call them directly. Deck content goes in and out only through `@sododeck/model`.
 */
import {
  createEditor,
  fromJSON,
  inspectDeckText,
  NEW_DECK_PACKS,
  isLegacyLayout,
  problemReport,
  serializeDeck,
  toJSON,
  type DeckDoc,
  type ProblemEntry,
  type ProblemReport,
} from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

import { importMermaidText, type MermaidImport } from '../import-mermaid/import-mermaid';
import { APP_VERSION } from '../lib/app-version';
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
    /**
     * Why a deck file was refused (062): the copyable report, entries sorted and capped. Plain
     * data, so it crosses the worker boundary and the library never needs the model to copy it.
     */
    readonly report?: ProblemReport,
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
  /**
   * What the opened deck should tell the user (062 US2): damaged pictures and problems of severity
   * error or warning, as the copyable report. `null` for a clean deck.
   */
  openReport: ProblemReport | null;
  /**
   * The file as read, only when at least one card has no position (027 FR-024): the caller places
   * those cards and imports the placed file instead. Pictures stay embedded in it.
   */
  unplaced?: SododeckFile;
}

const IMPORTED_NAME = 'Imported deck';

/** The file `inspectDeckText` accepted, as a plain object (its byte order mark dropped). */
function parseAccepted(text: string): SododeckFile {
  return JSON.parse(text.startsWith('\uFEFF') ? text.slice(1) : text) as SododeckFile;
}

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

/** The copyable report of an import (062): `name` is the file name, or the deck's. */
function reportOf(
  name: string,
  status: 'refused' | 'opened',
  entries: readonly ProblemEntry[],
): ProblemReport {
  return problemReport({ source: { kind: 'file', name }, status, app: APP_VERSION, entries });
}

const REFUSAL_MESSAGE: Record<'invalid-json' | 'unsupported-version' | 'invalid-deck', string> = {
  'invalid-json': 'The file is not JSON.',
  'unsupported-version': 'The file format is newer than this app.',
  'invalid-deck': 'The file is not a valid deck.',
};

/**
 * Parses and validates one deck file (FR-023, FR-024) through `inspectDeckText` (062): a refusal
 * throws `LibraryOpError` with the report of every problem found, and nothing is created. `name`
 * is the file name the reports carry.
 */
export function importFile(text: string, name = 'deck file'): ImportedDeck {
  const result = inspectDeckText(text);
  if (!result.ok) {
    const first = result.entries[0]?.code;
    const code =
      first === 'invalid-json' || first === 'unsupported-version' ? first : 'invalid-deck';
    throw new LibraryOpError(
      code,
      REFUSAL_MESSAGE[code],
      reportOf(name, 'refused', result.entries),
    );
  }
  const { loaded } = result;
  const doc = loaded.doc;
  // A library deck always has a name; a nameless file gets one (and keeps it on export).
  if (toJSON(doc).name === undefined) createEditor(doc).updateMeta({ name: IMPORTED_NAME });
  return {
    bytes: Y.encodeStateAsUpdate(doc),
    summary: summarizeDeck(toJSON(doc)),
    pictures: picturesOf(doc, loaded.bytes),
    openReport: result.entries.length === 0 ? null : reportOf(name, 'opened', result.entries),
    // Checked here, in the worker, so a fully placed deck never crosses back as a plain file.
    ...(toJSON(doc).nodes.some((node) => node.position === undefined)
      ? { unplaced: parseAccepted(text) }
      : {}),
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
