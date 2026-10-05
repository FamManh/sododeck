/**
 * A schema import report (044) as the public fidelity report (062 R9): every skipped statement
 * and every change sorted into merged / collapsed / left out / not supported, with a catalogue
 * code, the reason or detail text as the message, the target kept, and a fix hint where changing
 * the input helps. Pure.
 */
import type { FidelityCode, FidelityGroup } from '@sododeck/model';
import type { FidelityItem, FidelityReport } from '@sododeck/model/report-json';

import { SKIP_REASON_TEXT } from './report-text';
import type { ChangeKind, ChangedEntry, ImportReport, SkipReason, SkippedEntry } from './types';

interface Mapping {
  code: FidelityCode;
  group: FidelityGroup;
}

const leftOut = (code: FidelityCode): Mapping => ({ code, group: 'left-out' });

export const SKIP_MAPPING: Readonly<Record<SkipReason, Mapping>> = {
  view: leftOut('import-db-view'),
  function: leftOut('import-db-function'),
  procedure: leftOut('import-db-procedure'),
  trigger: leftOut('import-db-trigger'),
  grant: leftOut('import-db-grant'),
  policy: leftOut('import-db-policy'),
  partition: leftOut('import-db-partition'),
  sequence: leftOut('import-db-sequence'),
  extension: leftOut('import-db-extension'),
  // The schema name is kept on each table: the statement comes across in a simpler form.
  schema: { code: 'import-db-schema', group: 'collapsed' },
  data: leftOut('import-db-data'),
  session: leftOut('import-db-session'),
  'drop-or-rename': leftOut('import-db-drop-or-rename'),
  alter: leftOut('import-db-alter'),
  'dangling-fk': leftOut('import-db-dangling-fk'),
  'unknown-table': leftOut('import-db-unknown-table'),
  'parse-error': { code: 'import-db-parse-error', group: 'not-supported' },
  unknown: { code: 'import-db-unknown', group: 'not-supported' },
};

export const CHANGE_MAPPING: Readonly<Record<ChangeKind, Mapping>> = {
  'type-converted': { code: 'import-db-type-converted', group: 'collapsed' },
  'type-kept': { code: 'import-db-type-kept', group: 'collapsed' },
  'option-dropped': leftOut('import-db-option-dropped'),
  'renamed-duplicate': { code: 'import-db-renamed-duplicate', group: 'merged' },
  'name-exists': { code: 'import-db-name-exists', group: 'merged' },
  'enum-name-exists': { code: 'import-db-enum-name-exists', group: 'merged' },
  'schema-dropped': leftOut('import-db-schema-dropped'),
};

/** Where the user can change the input to get a better result (062 R9). */
const SKIP_FIX: Partial<Record<SkipReason, string>> = {
  'dangling-fk': 'Include the referenced table in the import.',
  'unknown-table': "Include the table's CREATE TABLE statement in the import.",
  'parse-error': 'Check the syntax of this statement.',
};
const CHANGE_FIX: Partial<Record<ChangeKind, string>> = {
  'renamed-duplicate': 'Give each table a unique name in the input.',
};

/** The report's texts are lower-case fragments ("views are not modelled"); items are sentences. */
function sentence(text: string): string {
  const trimmed = text.trim();
  const upper = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?…]$/.test(upper) ? upper : `${upper}.`;
}

function skippedItem(entry: SkippedEntry): FidelityItem {
  const fix = SKIP_FIX[entry.reason];
  return {
    ...SKIP_MAPPING[entry.reason],
    line: entry.line,
    excerpt: entry.excerpt,
    message: sentence(entry.detail ?? SKIP_REASON_TEXT[entry.reason]),
    ...(fix === undefined ? {} : { fix }),
  };
}

function changedItem(entry: ChangedEntry): FidelityItem {
  const fix = CHANGE_FIX[entry.kind];
  const where =
    entry.firstLine !== undefined && entry.line !== undefined
      ? { lines: [entry.firstLine, entry.line] }
      : entry.line === undefined
        ? {}
        : { line: entry.line };
  return {
    ...CHANGE_MAPPING[entry.kind],
    ...where,
    target: entry.target,
    message: sentence(entry.detail),
    ...(fix === undefined ? {} : { fix }),
  };
}

/** The line an item is sorted by: its own, or the last of its lines; none goes last. */
const lineOf = (item: FidelityItem) => item.line ?? item.lines?.at(-1) ?? Number.POSITIVE_INFINITY;

/** The fidelity report of a SQL or DBML import, items in input order. */
export function toFidelityReport(report: ImportReport): FidelityReport {
  const items = [...report.skipped.map(skippedItem), ...report.changed.map(changedItem)].sort(
    (a, b) => lineOf(a) - lineOf(b),
  );
  const { fileName, format, dialect } = report.source;
  return {
    report: 'sododeck-import',
    reportVersion: 1,
    source: {
      format,
      ...(fileName === undefined ? {} : { name: fileName }),
      ...(dialect === null ? {} : { dialect }),
    },
    created: { ...report.mapped },
    complete: items.length === 0,
    items,
  };
}
