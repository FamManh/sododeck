/**
 * The public report shapes of 062 and their JSON text (contract:
 * `specs/062-fixable-import-errors/contracts/problem-report.md`). Only type imports, so the app's
 * library route can copy a report through `@sododeck/model/report-json` without loading the model
 * (apps/app CLAUDE.md: the library route never imports the model at runtime).
 */
import type { FidelityCode, FidelityGroup } from './problem-codes';

export type EntrySeverity = 'error' | 'warning' | 'info';

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
