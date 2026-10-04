/**
 * Export notes (045, data-model §3): every part of the schema a writer skips or changes is one
 * note, never a silent drop (SC-006). Pure.
 */
import type { Id } from '@sododeck/schema';

/** The kinds, in list order. */
export const EXPORT_NOTE_KINDS = [
  'fk-out-of-scope',
  'unmapped-type',
  'default-size',
  'schema-dropped',
  'name-clash',
  'stale-reference',
  'length-mismatch',
  'no-columns',
  'junction-skipped',
  'self-junction',
  'junction-renamed',
  'no-key',
  'increment-dropped',
  'method-dropped',
  'enum-not-created',
  'empty-enum',
  'empty-type',
  'unnamed-table',
  'no-cardinality',
  'name-changed',
] as const;

export type ExportNoteKind = (typeof EXPORT_NOTE_KINDS)[number];

export interface ExportNote {
  kind: ExportNoteKind;
  message: string;
  tableId?: Id;
  columnId?: Id;
}

export function note(
  kind: ExportNoteKind,
  message: string,
  where: { tableId?: Id; columnId?: Id } = {},
): ExportNote {
  return {
    kind,
    message,
    ...(where.tableId === undefined ? {} : { tableId: where.tableId }),
    ...(where.columnId === undefined ? {} : { columnId: where.columnId }),
  };
}

const KIND_ORDER = new Map<ExportNoteKind, number>(EXPORT_NOTE_KINDS.map((kind, i) => [kind, i]));

/**
 * Identical notes merged; sorted by the position of their table in `tableOrder` (notes without a
 * table last), then by kind order; otherwise in the order they were made.
 */
export function mergeNotes(notes: readonly ExportNote[], tableOrder: readonly Id[]): ExportNote[] {
  const position = new Map(tableOrder.map((id, i) => [id, i]));
  const seen = new Set<string>();
  const unique: { note: ExportNote; i: number }[] = [];
  notes.forEach((entry, i) => {
    const key = JSON.stringify([entry.kind, entry.message, entry.tableId, entry.columnId]);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push({ note: entry, i });
  });
  const tableRank = (entry: ExportNote) =>
    entry.tableId === undefined
      ? Number.MAX_SAFE_INTEGER
      : (position.get(entry.tableId) ?? Number.MAX_SAFE_INTEGER - 1);
  return unique
    .sort(
      (a, b) =>
        tableRank(a.note) - tableRank(b.note) ||
        (KIND_ORDER.get(a.note.kind) ?? 0) - (KIND_ORDER.get(b.note.kind) ?? 0) ||
        a.i - b.i,
    )
    .map((entry) => entry.note);
}
