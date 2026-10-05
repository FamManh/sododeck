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
  type SododeckFile,
} from '@sododeck/schema';

import type { AssetProblem, AssetProblemReason } from './assets';
import type { TrimmedCrop } from './load-checks';
import { CATALOGUE, isCode } from './problem-codes';
import { problemLocator, type Problem, type ProblemLocation } from './problems';
import type { EntrySeverity, ProblemEntry, ProblemReport } from './report-json';

export {
  stringifyReport,
  type EntrySeverity,
  type FidelityItem,
  type FidelityReport,
  type ProblemEntry,
  type ProblemReport,
} from './report-json';

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

/** A problems-list entry (ADR 0013) as an entry at `where` in the file: its kind is its code. */
export function problemEntry(problem: Problem, where: ProblemLocation): ProblemEntry {
  return {
    code: problem.kind,
    severity: problem.severity,
    path: where.path,
    ...(where.subject === undefined ? {} : { subject: where.subject }),
    message: sentence(`${problem.title}: ${problem.detail}`),
    evidence: trimmed(problem.detail),
    fix: defaultFix(problem.kind),
  };
}

/** Every problem of `file`'s list as an entry, located in `file` (one locator for all), sorted. */
export function problemEntries(problems: readonly Problem[], file: SododeckFile): ProblemEntry[] {
  const locate = problemLocator(file);
  return sortEntries(problems.map((problem) => problemEntry(problem, locate(problem))));
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

/** An image crop cut back to the picture edge on load (057 rule C2): the deck opens as trimmed. */
export function cropEntry(trimmed: TrimmedCrop): ProblemEntry {
  return {
    code: 'crop-trimmed',
    severity: 'warning',
    path: trimmed.path,
    subject: trimmed.imageId,
    message: `The crop of image "${trimmed.imageId}" ran past the picture edge and was trimmed.`,
    fix: defaultFix('crop-trimmed'),
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
