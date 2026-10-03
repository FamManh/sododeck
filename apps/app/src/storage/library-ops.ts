/**
 * Library operations that need the deck model (research R7). Pure functions over Yjs update
 * bytes: the library worker runs them so the library route never loads Yjs or the model, and
 * tests call them directly. Deck content goes in and out only through `@sododeck/model`.
 */
import {
  createEditor,
  DeckValidationError,
  fromJSON,
  isLegacyLayout,
  serializeDeck,
  toJSON,
  type DeckDoc,
} from '@sododeck/model';
import { emptySododeckFile, FORMAT_VERSION, type SododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

import { summarizeDeck, type DeckSummary } from './deck-summary';
import { UNSUPPORTED_DECK_MESSAGE } from './library-ops-messages';

export type LibraryOpErrorCode =
  'invalid-json' | 'invalid-deck' | 'unsupported-version' | 'invalid-name' | 'unsupported-deck';

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

function checkName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '') throw new LibraryOpError('invalid-name', 'A deck name cannot be empty.');
  return trimmed;
}

/** A new, empty deck. */
export function create(name: string): DeckBytes {
  return fromFile({ ...emptySododeckFile(), name: checkName(name) });
}

/** Parses and validates one `.sododeck.json` file (FR-023, FR-024). */
export function importFile(text: string): DeckBytes {
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
  try {
    doc = fromJSON(parsed);
  } catch (error) {
    if (error instanceof DeckValidationError) {
      throw new LibraryOpError('invalid-deck', 'The file is not a valid deck.');
    }
    throw error;
  }
  // A library deck always has a name; a nameless file gets one (and keeps it on export).
  if (toJSON(doc).name === undefined) createEditor(doc).updateMeta({ name: IMPORTED_NAME });
  return { bytes: Y.encodeStateAsUpdate(doc), summary: summarizeDeck(toJSON(doc)) };
}

/** The model's export of a stored deck (FR-025). */
export function exportDeck(updates: readonly Uint8Array[]): { json: string; name: string } {
  const file = toJSON(load(updates));
  return { json: serializeDeck(file), name: file.name ?? 'Untitled deck' };
}

/** Renames through the model (research R6); returns only the change, to append to the log. */
export function rename(
  updates: readonly Uint8Array[],
  name: string,
): { delta: Uint8Array; summary: DeckSummary } {
  const next = checkName(name);
  const doc = load(updates);
  const before = Y.encodeStateVector(doc);
  const editor = createEditor(doc);
  editor.updateMeta({ name: next });
  editor.destroy();
  return { delta: Y.encodeStateAsUpdate(doc, before), summary: summarizeDeck(toJSON(doc)) };
}

/** An independent copy (new Yjs history) with a new name (FR-018). */
export function duplicate(updates: readonly Uint8Array[], name: string): DeckBytes {
  return fromFile({ ...toJSON(load(updates)), name: checkName(name) });
}
