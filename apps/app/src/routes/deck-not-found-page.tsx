import { Button } from '@sododeck/ui/components/button';
import { FileQuestion } from 'lucide-react';
import { Link } from 'react-router';

/** An old link or a deleted deck (spec edge case). */
export function DeckNotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app px-6 text-center">
      <FileQuestion aria-hidden strokeWidth={1.5} className="size-8 text-ink-secondary" />
      <h1 className="text-display">Deck not found</h1>
      <p className="max-w-md text-body text-ink-secondary">
        It may have been deleted, or it was stored in another browser.
      </p>
      <Button asChild variant="primary">
        <Link to="/">Back to library</Link>
      </Button>
    </main>
  );
}
