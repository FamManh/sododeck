import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { Plus } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router';

import type { DeckRecord, FolderRecord } from '../storage/library-db';
import { DeckCard } from './deck-card';
import { DeckRow } from './deck-row';
import type { ViewMode } from './library-store';
import { useNow } from './use-now';
import type { LibraryCommands } from './use-library-commands';

/** Arrow keys move between deck links (left/right by one, up/down by a row). */
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[event.key];
  if (step === undefined || !(event.target instanceof HTMLElement)) return;
  if (!event.target.matches('[data-deck-link], [data-new-deck]')) return;
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>('[data-new-deck], [data-deck-link]'),
  ];
  const index = items.indexOf(event.target);
  if (index < 0) return;
  let by = step;
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    const top = items[0]?.getBoundingClientRect().top ?? 0;
    const columns = items.filter((el) => el.getBoundingClientRect().top === top).length;
    // Without layout (one "row" holding everything) up/down act like left/right.
    if (columns < items.length) by = step * columns;
  }
  const next = items[index + by];
  if (!next) return;
  event.preventDefault();
  next.focus();
}

/** The dashed "New deck" card (DESIGN.md `new-deck-card`). */
function NewDeckCard({ href }: { href: string }) {
  return (
    <li className="min-w-0">
      <Link
        to={href}
        data-new-deck
        className={cn(
          'flex h-full min-h-60 flex-col items-center justify-center gap-2 rounded-deck-card border-[1.5px] border-dashed border-border text-center transition-colors hover:border-primary',
          focusRing,
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-card bg-surface-2 text-ink-secondary">
          <Plus aria-hidden strokeWidth={1.5} className="size-5" />
        </span>
        <span className="text-title-sm text-ink">New deck</span>
        <span className="text-caption text-ink-secondary">Blank canvas, saved locally</span>
      </Link>
    </li>
  );
}

/** Decks as cards (grid) or rows (list), with the New deck card first in the grid. */
export function DeckGrid({
  decks,
  folders,
  commands,
  viewMode,
  newDeckHref,
}: {
  decks: readonly DeckRecord[];
  folders: readonly FolderRecord[];
  commands: LibraryCommands | null;
  viewMode: ViewMode;
  /** `null` hides the New deck card (Recent, Samples, search results). */
  newDeckHref: string | null;
}) {
  const now = useNow();
  if (viewMode === 'list') {
    if (decks.length === 0 || !commands) return null;
    return (
      <table
        aria-label="Decks"
        className="w-full overflow-hidden rounded-card bg-surface text-body"
      >
        <thead className="text-left text-caption text-ink-secondary">
          <tr>
            <th scope="col" className="py-2 pr-4 pl-4 font-medium">
              Name
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Folder
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Components
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Flows
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Edited
            </th>
            <th scope="col" className="w-12">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody onKeyDown={moveFocus}>
          {decks.map((deck) => (
            <DeckRow key={deck.id} deck={deck} folders={folders} commands={commands} now={now} />
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <ul
      aria-label="Decks"
      onKeyDown={moveFocus}
      className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4"
    >
      {newDeckHref !== null && <NewDeckCard href={newDeckHref} />}
      {commands &&
        decks.map((deck) => (
          <DeckCard key={deck.id} deck={deck} folders={folders} commands={commands} now={now} />
        ))}
    </ul>
  );
}
