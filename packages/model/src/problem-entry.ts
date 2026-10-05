/**
 * Public problem entries and copied reports (062, ADR 0039; contract:
 * `specs/062-fixable-import-errors/contracts/problem-report.md`). File issues, problems-list
 * entries and damaged pictures all become one entry shape; reports are plain JSON with a fixed key
 * order and no timestamp, so the same file always copies to the same bytes (SC-003). Pure.
 */
import {
  comparePointers,
  EVIDENCE_MAX,
  evidenceOf,
  FORMAT_VERSION,
  fromPointer,
  SCHEMA_URL,
  toPointer,
  valueAt,
  type Issue,
} from '@sododeck/schema';

import type { AssetProblem, AssetProblemReason } from './assets';
import { CATALOGUE, isCode, type FidelityCode, type FidelityGroup } from './problem-codes';
import type { Problem, Severity } from './problems';

export type EntrySeverity = Severity | 'info';

/** One problem as shown in the import problems dialog and copied as JSON. */
export interface ProblemEntry {
  /** Stable code from the catalogue. */
  code: string;
  severity: EntrySeverity;
  /** JSON Pointer; absent only for `invalid-json`, which has `line` / `column`. */
  path?: string;
  line?: number;
  column?: number;
  subject?: string;
  message: string;
  evidence?: string;
  /** Always present: the entry's own hint or the catalogue default (FR-005). */
  fix: string;
}

export interface ProblemReport {
  report: 'sododeck-problems';
  reportVersion: 1;
  source: { kind: 'file' | 'deck'; name: string };
  status: 'refused' | 'opened';
  schema: string;
  formatVersion: number;
  app: string;
  /** Over every entry, omitted ones included. */
  counts: Record<EntrySeverity, number>;
  problems: ProblemEntry[];
  /** Entries beyond {@link REPORT_LIMIT}. */
  omitted: number;
}

export interface FidelityItem {
  code: FidelityCode;
  group: FidelityGroup;
  /** 1-based input line; absent for notes about the whole input. */
  line?: number;
  /** For merged items that combine several declarations. */
  lines?: number[];
  excerpt?: string;
  /** DB: `orders.status`, `orders`. */
  target?: string;
  message: string;
  /** Only when changing the input gives a better result. */
  fix?: string;
}

export interface FidelityReport {
  report: 'sododeck-import';
  reportVersion: 1;
  source: {
    format: 'mermaid-flowchart' | 'mermaid-sequence' | 'sql' | 'dbml';
    name?: string;
    dialect?: string;
  };
  created: Record<string, number>;
  /** `true` when nothing was lost ("Everything was imported", FR-015). */
  complete: boolean;
  items: FidelityItem[];
}

/** Most entries a copied report holds (062 edge case "very many problems"). */
export const REPORT_LIMIT = 5000;

function defaultFix(code: string): string {
  return isCode(code) ? CATALOGUE[code].fix : 'Fix this value so it matches the file format.';
}

/**
 * A file issue as an entry: severity `error` (it refuses the file), the issue's own fix or the
 * catalogue's, and evidence read from `input` at the issue's path when the issue has none.
 */
export function issueEntry(issue: Issue, input?: unknown): ProblemEntry {
  const evidence =
    issue.evidence ??
    (input === undefined ? undefined : evidenceOf(valueAt(input, fromPointer(issue.path))));
  return {
    code: issue.code,
    severity: 'error',
    path: issue.path,
    ...(issue.subject === undefined ? {} : { subject: issue.subject }),
    message: issue.message,
    ...(evidence === undefined ? {} : { evidence }),
    fix: issue.fix ?? defaultFix(issue.code),
  };
}

const trimmed = (text: string) =>
  text.length > EVIDENCE_MAX ? `${text.slice(0, EVIDENCE_MAX - 1)}…` : text;

const sentence = (text: string) => (/[.!?…]$/.test(text) ? text : `${text}.`);

/** A problems-list entry (ADR 0013) as an entry: its kind is its code. */
export function problemEntry(problem: Problem): ProblemEntry {
  return {
    code: problem.kind,
    severity: problem.severity,
    path: problem.path,
    ...(problem.subject === undefined ? {} : { subject: problem.subject }),
    message: sentence(`${problem.title}: ${problem.detail}`),
    evidence: trimmed(problem.detail),
    fix: defaultFix(problem.kind),
  };
}

const PICTURE_REASON: Readonly<Record<AssetProblemReason, string>> = {
  'bad-data': 'its data is not valid base64',
  'size-mismatch': 'its data does not match its size',
  'too-large': 'it is larger than 5 MiB',
  'bad-type': 'its type is not a supported picture type',
  'hash-mismatch': 'its data does not match its id',
};

/** A picture repaired on load (055): the deck opens and shows it as missing. */
export function pictureEntry(problem: AssetProblem): ProblemEntry {
  const name = problem.name === undefined || problem.name === '' ? problem.id : `"${problem.name}"`;
  return {
    code: 'picture-damaged',
    severity: 'warning',
    path: toPointer(['assets', problem.id]),
    subject: problem.id,
    message: `Picture ${name} is damaged: ${PICTURE_REASON[problem.reason]}.`,
    evidence: problem.reason,
    fix: defaultFix('picture-damaged'),
  };
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Entries in file order (FR-006): line-addressed ones first (by line, column), then by pointer
 * (array indexes numerically), then code, then message. Stable for the same input.
 */
export function sortEntries(entries: readonly ProblemEntry[]): ProblemEntry[] {
  return [...entries].sort((a, b) => {
    if (a.path === undefined || b.path === undefined) {
      if (a.path !== undefined) return 1;
      if (b.path !== undefined) return -1;
      return (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0);
    }
    return (
      comparePointers(a.path, b.path) ||
      compareText(a.code, b.code) ||
      compareText(a.message, b.message)
    );
  });
}

/** The copied report for `entries` (already sorted), capped at {@link REPORT_LIMIT}. */
export function problemReport(args: {
  source: { kind: 'file' | 'deck'; name: string };
  status: 'refused' | 'opened';
  app: string;
  entries: readonly ProblemEntry[];
}): ProblemReport {
  const counts: Record<EntrySeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const entry of args.entries) counts[entry.severity] += 1;
  return {
    report: 'sododeck-problems',
    reportVersion: 1,
    source: { kind: args.source.kind, name: args.source.name },
    status: args.status,
    schema: SCHEMA_URL,
    formatVersion: FORMAT_VERSION,
    app: args.app,
    counts,
    problems: args.entries.slice(0, REPORT_LIMIT),
    omitted: Math.max(0, args.entries.length - REPORT_LIMIT),
  };
}

/** Copies `value` with keys in `order` first (absent ones skipped), then any others. */
function ordered<T extends object>(value: T, order: readonly string[]): T {
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of order) if (record[key] !== undefined) out[key] = record[key];
  for (const [key, item] of Object.entries(record)) {
    if (!(key in out) && item !== undefined) out[key] = item;
  }
  return out as T;
}

const PROBLEM_REPORT_KEYS = [
  'report',
  'reportVersion',
  'source',
  'status',
  'schema',
  'formatVersion',
  'app',
  'counts',
  'problems',
  'omitted',
];
const ENTRY_KEYS = [
  'code',
  'severity',
  'path',
  'line',
  'column',
  'subject',
  'message',
  'evidence',
  'fix',
];
const FIDELITY_REPORT_KEYS = ['report', 'reportVersion', 'source', 'created', 'complete', 'items'];
const FIDELITY_SOURCE_KEYS = ['format', 'name', 'dialect'];
const ITEM_KEYS = ['code', 'group', 'line', 'lines', 'excerpt', 'target', 'message', 'fix'];

/** A report as pretty-printed JSON (2 spaces) in the contract's key order; nothing else (FR-018). */
export function stringifyReport(report: ProblemReport | FidelityReport): string {
  const shaped =
    report.report === 'sododeck-problems'
      ? ordered(
          {
            ...report,
            source: ordered(report.source, ['kind', 'name']),
            counts: ordered(report.counts, ['error', 'warning', 'info']),
            problems: report.problems.map((entry) => ordered(entry, ENTRY_KEYS)),
          },
          PROBLEM_REPORT_KEYS,
        )
      : ordered(
          {
            ...report,
            source: ordered(report.source, FIDELITY_SOURCE_KEYS),
            items: report.items.map((item) => ordered(item, ITEM_KEYS)),
          },
          FIDELITY_REPORT_KEYS,
        );
  return JSON.stringify(shaped, null, 2);
}
