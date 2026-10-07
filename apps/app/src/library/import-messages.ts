import type { ProblemReport } from '@sododeck/model';

import { LibraryClientError } from '../storage/library-client-error';

/**
 * Wording and counts for deck imports. Kept apart from `library-actions.ts` (which reaches the
 * library database) so editor code that must stay storage-free, such as the deck menu in the embed
 * build, can use them.
 */

export function importMessage(error: unknown): string {
  if (error instanceof LibraryClientError && error.code === 'unsupported-version') {
    return 'That file was made with a newer version of Sododeck.';
  }
  return 'That file is not a valid .sododeck or .sododeck.md file. Older .sododeck.json files also open.';
}

export function problemCount(report: ProblemReport | null): number {
  if (report === null) return 0;
  return report.counts.error + report.counts.warning + report.counts.info;
}

/** The import toast: names the deck and, once, how many problems it opened with (062 FR-011). */
export function importedMessage(name: string, problems: number, suffix = ''): string {
  const base = `Imported "${name}"${suffix}`;
  if (problems === 0) return base;
  return `${base} with ${String(problems)} problem${problems === 1 ? '' : 's'}`;
}
