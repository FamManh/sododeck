import type { Issue } from '@sododeck/schema';

/**
 * Why an edit was refused: a field of the candidate object (`title`, `/steps/0/edge`, or a JSON
 * Pointer from the format check) and a sentence. File issues (`Issue`) fit this shape too; edit
 * refusals carry no public code because they are never copied for an AI (062).
 */
export interface EditIssue {
  path: string;
  message: string;
}

function describe(issues: readonly EditIssue[]): string {
  return issues.map((i) => (i.path === '' ? i.message : `${i.path}: ${i.message}`)).join('; ');
}

/**
 * A file that cannot be loaded: invalid for format v1, or with duplicate or ambiguous ids. Every
 * issue carries a code and a JSON Pointer path (062).
 */
export class DeckValidationError extends Error {
  constructor(readonly issues: Issue[]) {
    super(`Invalid .sododeck.json: ${describe(issues)}`);
    this.name = 'DeckValidationError';
  }
}

export type DeckEditErrorCode =
  | 'invalid'
  | 'not-found'
  | 'missing-reference'
  | 'duplicate-id'
  /** The target is locked (053): a locked note or connector refuses move, resize, reshape, reconnect and delete. */
  | 'locked';

/** An edit that was refused. It is always thrown before anything is written. */
export class DeckEditError extends Error {
  constructor(
    readonly code: DeckEditErrorCode,
    readonly issues: EditIssue[],
  ) {
    super(`Edit refused (${code}): ${describe(issues)}`);
    this.name = 'DeckEditError';
  }
}
