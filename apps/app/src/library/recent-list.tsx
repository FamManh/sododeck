import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { Clock } from 'lucide-react';
import { Link } from 'react-router';

import type { DeckRecord } from '../storage/library-db';
import { relativeTime } from './library-view';
import { useNow } from './use-now';

/** The sidebar's recently opened decks (design 78); hidden until a deck was opened. */
export function RecentList({ decks }: { decks: readonly DeckRecord[] }) {
  const now = useNow();
  if (decks.length === 0) return null;
  return (
    <section aria-labelledby="library-recent-heading" className="flex flex-col gap-0.5">
      <h2
        id="library-recent-heading"
        className="flex items-center justify-between px-2 pb-1 text-micro text-ink-secondary uppercase"
      >
        Recent
      </h2>
      <ul className="flex flex-col gap-0.5">
        {decks.map((deck) => (
          <li key={deck.id}>
            <Link
              to={`/deck/${deck.id}`}
              className={cn(
                'flex h-8 items-center gap-2.5 rounded-row px-2 text-body text-ink hover:bg-surface-2',
                focusRing,
              )}
            >
              <Clock aria-hidden strokeWidth={1.5} className="size-4 shrink-0 text-ink-secondary" />
              <span className="min-w-0 flex-1 truncate" title={deck.name}>
                {deck.name}
              </span>
              <span className="shrink-0 text-caption text-ink-secondary">
                {deck.openedAt === null ? '' : relativeTime(deck.openedAt, now)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
