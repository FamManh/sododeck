import { useState } from 'react';

import type { DeckRecord, FolderRecord } from '../storage/library-db';
import { DeckContextMenu, DeckMenuButton } from './deck-menu';
import { deckKeyHandler } from './deck-keys';
import { DeckName } from './deck-name';
import { relativeTime } from './library-view';
import type { LibraryCommands } from './use-library-commands';

/** One deck in the list view (design 07, 77). */
export function DeckRow({
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
    <DeckContextMenu deck={deck} folders={folders} commands={commands}>
      <tr
        onKeyDown={deckKeyHandler(deck, commands, () => {
          setMenuOpen(true);
        })}
        className="group border-t border-hairline hover:bg-surface-2"
      >
        <td className="max-w-80 py-2 pr-4 pl-4">
          <DeckName deck={deck} commands={commands} />
        </td>
        <td className="py-2 pr-4 text-ink-secondary">{folder?.name ?? 'Unfiled'}</td>
        <td className="py-2 pr-4 text-right tabular-nums">{deck.nodeCount}</td>
        <td className="py-2 pr-4 text-right tabular-nums">{deck.flowCount}</td>
        <td className="py-2 pr-4 text-ink-secondary">{relativeTime(deck.updatedAt, now)}</td>
        <td className="w-12 py-1 pr-2 text-right">
          <DeckMenuButton
            deck={deck}
            folders={folders}
            commands={commands}
            open={menuOpen}
            onOpenChange={setMenuOpen}
          />
        </td>
      </tr>
    </DeckContextMenu>
  );
}
