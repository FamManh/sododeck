/**
 * A Mermaid import report as the public fidelity report (062 R9, contracts/problem-report.md):
 * every skipped line sorted into merged / collapsed / left out / not supported, with a catalogue
 * code, and a fix hint only where changing the input gives a better result. Pure, and free of
 * model runtime imports, so the library route can call it.
 */
import type { FidelityCode, FidelityGroup } from '@sododeck/model';
import type { FidelityItem, FidelityReport } from '@sododeck/model/report-json';

import {
  describeReason,
  type ImportReport,
  type SkipReason,
  type SkippedLine,
} from './import-report';

const MAPPING: Readonly<Record<SkipReason, { code: FidelityCode; group: FidelityGroup }>> = {
  appearance: { code: 'import-mermaid-appearance', group: 'left-out' },
  interaction: { code: 'import-mermaid-interaction', group: 'left-out' },
  'extra-diagram': { code: 'import-mermaid-extra-diagram', group: 'left-out' },
  unsupported: { code: 'import-mermaid-unsupported', group: 'not-supported' },
  unreadable: { code: 'import-mermaid-unreadable', group: 'not-supported' },
  flattened: { code: 'import-mermaid-flattened', group: 'collapsed' },
  merged: { code: 'import-mermaid-merged-declaration', group: 'merged' },
};

/** Fix hints where the user can change the input (062 R9); styling and clicks have none. */
const FIX: Partial<Record<SkipReason, string>> = {
  unreadable: 'Check the syntax on this line.',
  unsupported: 'Rewrite the line with the supported flowchart or sequence syntax.',
  'extra-diagram': 'Import each diagram on its own.',
};

function itemOf(entry: SkippedLine): FidelityItem {
  const { code, group } = MAPPING[entry.reason];
  if (entry.reason === 'merged' && entry.key !== undefined) {
    return {
      code,
      group,
      ...(entry.lines === undefined ? { line: entry.line } : { lines: entry.lines }),
      excerpt: entry.text,
      message: `"${entry.key}" is declared more than once; the declarations were combined into one.`,
      fix: `Declare "${entry.key}" once, or give the second one its own id.`,
    };
  }
  const fix = FIX[entry.reason];
  return {
    code,
    group,
    line: entry.line,
    excerpt: entry.text,
    message: describeReason(entry.reason),
    ...(fix === undefined ? {} : { fix }),
  };
}

/** The fidelity report of a Mermaid import; `name` is the file name, when there is one. */
export function toFidelityReport(report: ImportReport, name?: string): FidelityReport {
  const lines = [...report.skipped].sort((a, b) => a.line - b.line).map(itemOf);
  const notes = report.notes.map((note): FidelityItem => ({
    ...NOTE,
    message: note.endsWith('.') ? note : `${note}.`,
  }));
  const items = [...lines, ...notes];
  return {
    report: 'sododeck-import',
    reportVersion: 1,
    source: {
      format: report.kind === 'flowchart' ? 'mermaid-flowchart' : 'mermaid-sequence',
      ...(name === undefined ? {} : { name }),
    },
    created: { ...report.counts },
    complete: items.length === 0,
    items,
  };
}

const NOTE = { code: 'import-mermaid-note', group: 'collapsed' } as const;
