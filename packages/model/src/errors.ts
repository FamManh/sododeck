import type { Issue } from '@sododeck/schema';

function describe(issues: Issue[]): string {
  return issues.map((i) => (i.path === '' ? i.message : `${i.path}: ${i.message}`)).join('; ');
}

/** A file that cannot be loaded: invalid for format v1, or with duplicate ids. */
export class DeckValidationError extends Error {
  constructor(readonly issues: Issue[]) {
    super(`Invalid .sododeck.json: ${describe(issues)}`);
    this.name = 'DeckValidationError';
  }
}

export type DeckEditErrorCode = 'invalid' | 'not-found' | 'missing-reference' | 'duplicate-id';

/** An edit that was refused. It is always thrown before anything is written. */
export class DeckEditError extends Error {
  constructor(
    readonly code: DeckEditErrorCode,
    readonly issues: Issue[],
  ) {
    super(`Edit refused (${code}): ${describe(issues)}`);
    this.name = 'DeckEditError';
  }
}
