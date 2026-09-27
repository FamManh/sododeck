/**
 * Text of single deck objects, formatted exactly as they appear in the file (004 research R1).
 * The JSON panel's Selection tab uses these so the app never serializes deck data itself
 * (constitution II): same canonical key order and indentation as `serializeDeck`.
 */
import { canonicalizeEntry } from './key-order';
import type { Collection } from './layout';

export type EntryCollection = Collection | 'rules';

export interface Entry {
  collection: EntryCollection;
  /** A plain object of that collection, e.g. from `createDeckSnapshot().get()`. */
  value: unknown;
}

/** One object as in the file, without the file's nesting indent or trailing comma. */
export function serializeEntry(collection: EntryCollection, value: unknown): string {
  return JSON.stringify(canonicalizeEntry(collection, value), null, 2);
}

/** A JSON array of objects, each formatted as in the file. No trailing newline. */
export function serializeEntries(entries: readonly Entry[]): string {
  return JSON.stringify(
    entries.map((entry) => canonicalizeEntry(entry.collection, entry.value)),
    null,
    2,
  );
}
