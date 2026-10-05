import type { ProblemReport } from '@sododeck/model';

import type { LibraryOpErrorCode } from './library-ops';

/** A failed library operation, with the reason the UI turns into a message. */
export class LibraryClientError extends Error {
  constructor(
    readonly code: LibraryOpErrorCode | 'failed',
    message: string,
    /** A refused deck file's report (062), for the import problems dialog. */
    readonly report?: ProblemReport,
  ) {
    super(message);
    this.name = 'LibraryClientError';
  }
}
