import { Button } from '@sododeck/ui/components/button';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <h1 className="text-display">Page not found</h1>
      <Button asChild>
        <Link to="/">Back to your decks</Link>
      </Button>
    </main>
  );
}
