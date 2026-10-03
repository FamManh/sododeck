import { LibraryClientError } from '../storage/library-client-error';
import { UNSUPPORTED_DECK_MESSAGE } from '../storage/library-ops-messages';

/** What a failed deck command (rename, duplicate, export) tells the user. */
export function libraryErrorMessage(error: unknown): string {
  if (error instanceof LibraryClientError && error.code === 'unsupported-deck') {
    return UNSUPPORTED_DECK_MESSAGE;
  }
  return 'Something went wrong. Nothing was changed.';
}
