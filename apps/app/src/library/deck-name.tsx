import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { Link } from 'react-router';

import type { DeckRecord } from '../storage/library-db';
import { renameDeck } from './library-actions';
import { libraryErrorMessage } from './library-error-message';
import { useLibraryStore } from './library-store';
import { RenameField } from './rename-field';
import type { LibraryCommands } from './use-library-commands';

/**
 * The deck's name: a link that opens it (Enter), or the inline rename field after F2. Long names
 * are cut with an ellipsis and shown in full on hover; assistive technology reads the full name.
 */
export function DeckName({
  deck,
  commands,
  stretched = false,
}: {
  deck: DeckRecord;
  commands: LibraryCommands;
  /** The link covers its whole card, so a click anywhere opens the deck. */
  stretched?: boolean;
}) {
  const renaming = useLibraryStore((s) => s.renamingId === deck.id);
  const stopRenaming = () => {
    useLibraryStore.getState().setRenaming(null);
  };

  if (renaming) {
    return (
      <RenameField
        initial={deck.name}
        label="Deck name"
        className="relative z-10"
        onSubmit={async (name) => {
          try {
            await renameDeck(commands.ctx, deck.id, name);
          } catch (error) {
            return libraryErrorMessage(error);
          }
          return null;
        }}
        onDone={() => {
          stopRenaming();
          // Back to the deck link, so keyboard users keep their place.
          setTimeout(() => {
            document.querySelector<HTMLElement>(`[data-deck-link="${deck.id}"]`)?.focus();
          }, 0);
        }}
      />
    );
  }
  return (
    <Link
      to={`/deck/${deck.id}`}
      data-deck-link={deck.id}
      title={deck.name}
      className={cn(
        'block truncate rounded-segment text-title-sm text-ink',
        stretched ? 'outline-none after:absolute after:inset-0 after:content-[""]' : focusRing,
      )}
    >
      {deck.name}
    </Link>
  );
}
