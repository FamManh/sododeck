import { describe, expect, it } from 'vitest';

import { LibraryClientError } from '../storage/library-client-error';
import { libraryErrorMessage } from './library-error-message';

describe('libraryErrorMessage', () => {
  it('explains a deck stored by an earlier build (036 FR-027)', () => {
    expect(libraryErrorMessage(new LibraryClientError('unsupported-deck', 'x'))).toBe(
      "This deck was saved by an earlier development build and can't be opened. Import its exported .sododeck.json file again.",
    );
  });

  it('falls back to a generic message', () => {
    expect(libraryErrorMessage(new Error('boom'))).toBe(
      'Something went wrong. Nothing was changed.',
    );
    expect(libraryErrorMessage(new LibraryClientError('failed', 'x'))).toBe(
      'Something went wrong. Nothing was changed.',
    );
  });
});
