/**
 * Messages of library operation errors, kept apart from `library-ops.ts` so the library route and
 * the not-found page can show them without loading Yjs or the model.
 */

/** Why a deck stored by a build before 036 is refused (no migration: founder, §g-81 / §g-82). */
export const UNSUPPORTED_DECK_MESSAGE =
  "This deck was saved by an earlier development build and can't be opened. Import its exported .sododeck.json file again.";
