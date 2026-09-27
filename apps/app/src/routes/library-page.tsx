import { Button } from '@sododeck/ui/components/button';
import { ArrowRight, HardDrive } from 'lucide-react';
import { Link } from 'react-router';

import { Wordmark } from '../editor/wordmark';

/** Local deck library. Placeholder until M1 (Dexie-backed list, create/rename/delete). */
export function LibraryPage() {
  return (
    <div className="grid min-h-dvh grid-rows-[56px_1fr]">
      <header className="flex items-center border-b border-hairline bg-surface px-4">
        <Wordmark />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-display">Your decks</h1>
          <p className="flex items-center gap-1.5 text-body text-ink-muted">
            <HardDrive className="size-4" strokeWidth={1.5} />
            Decks live in this browser. The local library arrives in Milestone 1.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
          <article className="flex flex-col gap-3 rounded-deck-card border border-hairline bg-surface p-4">
            <div className="h-37 rounded-card bg-canvas bg-[radial-gradient(var(--color-dot)_1px,transparent_1px)] bg-size-[22px_22px]" />
            <div className="flex flex-col gap-0.5">
              <h2 className="text-title-sm">Demo deck</h2>
              <p className="text-caption text-ink-muted">3 nodes · 2 edges · sample</p>
            </div>
            <Button asChild variant="primary">
              <Link to="/deck/demo">
                Open demo deck
                <ArrowRight />
              </Link>
            </Button>
          </article>
        </div>
      </main>
    </div>
  );
}
