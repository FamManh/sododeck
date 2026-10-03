import { Button } from '@sododeck/ui/components/button';
import { FileQuestion } from 'lucide-react';
import { Link } from 'react-router';

import { UNSUPPORTED_DECK_MESSAGE } from '../storage/library-ops-messages';

const COPY = {
  // An old link or a deleted deck (spec edge case).
  missing: {
    title: 'Deck not found',
    body: 'It may have been deleted, or it was stored in another browser.',
  },
  // Stored by a development build before 036, which this build cannot read (036 FR-027).
  unsupported: { title: "This deck can't be opened", body: UNSUPPORTED_DECK_MESSAGE },
} as const;

/** The editor route's page for a deck it cannot show. */
export function DeckNotFoundPage({ reason = 'missing' }: { reason?: keyof typeof COPY }) {
  const { title, body } = COPY[reason];
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app px-6 text-center">
      <FileQuestion aria-hidden strokeWidth={1.5} className="size-8 text-ink-secondary" />
      <h1 className="text-display">{title}</h1>
      <p className="max-w-md text-body text-ink-secondary">{body}</p>
      <Button asChild variant="primary">
        <Link to="/">Back to library</Link>
      </Button>
    </main>
  );
}
