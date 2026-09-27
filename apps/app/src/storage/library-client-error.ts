import type { LibraryOpErrorCode } from './library-ops';

/** A failed library operation, with the reason the UI turns into a message. */
export class LibraryClientError extends Error {
  constructor(
    readonly code: LibraryOpErrorCode | 'failed',
    message: string,
  ) {
    super(message);
    this.name = 'LibraryClientError';
  }
}
