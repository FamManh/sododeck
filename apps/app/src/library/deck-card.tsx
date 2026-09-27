import { Folder } from 'lucide-react';
import { useState } from 'react';

import type { DeckRecord, FolderRecord } from '../storage/library-db';
import { DeckContextMenu, DeckMenuButton } from './deck-menu';
import { deckKeyHandler } from './deck-keys';
import { DeckName } from './deck-name';
import { DeckThumbnail } from './deck-thumbnail';
import { deckMeta } from './library-view';
import type { LibraryCommands } from './use-library-commands';

/** One deck in the grid (DESIGN.md `deck-card`, design 01/76). */
export function DeckCard({
  deck,
  folders,
  commands,
  now,
}: {
  deck: DeckRecord;
  folders: readonly FolderRecord[];
  commands: LibraryCommands;
  now: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const folder = folders.find((f) => f.id === deck.folderId);

  return (
    <li className="min-w-0">
      <DeckContextMenu deck={deck} folders={folders} commands={commands}>
        <article
          onKeyDown={deckKeyHandler(deck, commands, () => {
            setMenuOpen(true);
          })}
          className="group relative flex h-full flex-col overflow-hidden rounded-deck-card border border-hairline bg-surface transition-shadow duration-(--sd-dur-hover) hover:shadow-float has-[[data-deck-link]:focus-visible]:outline-2 has-[[data-deck-link]:focus-visible]:outline-offset-2 has-[[data-deck-link]:focus-visible]:outline-primary has-[[data-deck-link]:focus-visible]:outline-solid"
        >
          <DeckThumbnail name={deck.name} thumb={deck.thumb} />
          <div className="flex min-w-0 flex-col gap-1 border-t border-hairline px-4 pt-3 pb-3.5">
            <DeckName deck={deck} commands={commands} stretched />
            <p className="flex min-w-0 items-center gap-3 text-caption text-ink-secondary">
              <span className="min-w-0 flex-1 truncate">{deckMeta(deck, now)}</span>
              {folder && (
                <span className="flex max-w-[40%] shrink-0 items-center gap-1">
                  <Folder aria-hidden strokeWidth={1.5} className="size-3.5 shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </span>
              )}
            </p>
          </div>
          <DeckMenuButton
            deck={deck}
            folders={folders}
            commands={commands}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            className="absolute top-2.5 right-2.5 z-10 opacity-0 shadow-rest group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          />
        </article>
      </DeckContextMenu>
    </li>
  );
}
