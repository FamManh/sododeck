/**
 * Import report texts (044 T007, FR-017): one reason per skip kind, the excerpt of a statement and
 * the collapse of long runs of one kind. Pure.
 */
import type { SkipReason, SkippedEntry } from './types';

export const SKIP_REASON_TEXT: Record<SkipReason, string> = {
  view: 'views are not modelled',
  function: 'functions are not modelled',
  procedure: 'procedures are not modelled',
  trigger: 'triggers are not modelled',
  grant: 'permissions and owners are not modelled',
  policy: 'policies are not modelled',
  partition: 'partitions are not modelled',
  sequence: 'sequences are not modelled',
  extension: 'extensions are not modelled',
  schema: 'schemas are stored on their tables',
  data: 'data rows are not imported',
  session: 'session setting',
  'drop-or-rename': 'drops and renames are not applied',
  alter: 'only ADD COLUMN and ADD CONSTRAINT changes are applied',
  'dangling-fk': 'references a table or column that is not in this import',
  'unknown-table': 'changes a table that is not in this import',
  'parse-error': 'could not be read',
  unknown: 'not recognised',
};

/** The statement kinds a collapsed run is named after ("and 37 more INSERT statements"). */
const RUN_NOUN: Partial<Record<SkipReason, string>> = {
  data: 'data statements',
  grant: 'permission statements',
  session: 'session settings',
  function: 'functions',
  sequence: 'sequences',
  view: 'views',
  trigger: 'triggers',
};

const EXCERPT_LENGTH = 60;

/** The first line of `text`, collapsed spaces, at most 60 characters with an ellipsis. */
export function excerpt(text: string): string {
  const first = (text.trim().split('\n')[0] ?? '').replace(/\s+/g, ' ').trim();
  return first.length <= EXCERPT_LENGTH ? first : `${first.slice(0, EXCERPT_LENGTH - 1)}…`;
}

/** The text shown for a skipped entry: its own detail, else its reason's text. */
export function skipText(entry: Pick<SkippedEntry, 'reason' | 'detail'>): string {
  return entry.detail ?? SKIP_REASON_TEXT[entry.reason];
}

export type SkippedRow =
  | { kind: 'entry'; entry: SkippedEntry }
  | { kind: 'more'; reason: SkipReason; count: number; text: string };

const COLLAPSE_AFTER = 20;

/**
 * The report's skipped rows: more than 20 entries of one reason keep the first 20 and end with
 * "and n more …" (contracts/import-dialog-ui.md). Order is kept.
 */
export function collapseSkipped(entries: readonly SkippedEntry[]): SkippedRow[] {
  const total = new Map<SkipReason, number>();
  for (const entry of entries) total.set(entry.reason, (total.get(entry.reason) ?? 0) + 1);
  const shown = new Map<SkipReason, number>();
  const rows: SkippedRow[] = [];
  for (const entry of entries) {
    const count = (shown.get(entry.reason) ?? 0) + 1;
    shown.set(entry.reason, count);
    if (count <= COLLAPSE_AFTER) rows.push({ kind: 'entry', entry });
    if (count === COLLAPSE_AFTER + 1) {
      const rest = (total.get(entry.reason) ?? 0) - COLLAPSE_AFTER;
      const noun = RUN_NOUN[entry.reason] ?? 'statements of this kind';
      rows.push({
        kind: 'more',
        reason: entry.reason,
        count: rest,
        text: `and ${String(rest)} more ${noun}`,
      });
    }
  }
  return rows;
}

/** "1 table", "2 tables". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}
