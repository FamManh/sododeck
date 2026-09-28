import { Button } from '@sododeck/ui/components/button';
import { Shapes } from 'lucide-react';
import type { ReactNode } from 'react';

import { useUiStore } from '../state/ui-store';
import { focusPalette } from './canvas-actions';

/** Shown on an empty deck (design 37): how to start, and a way to the palette. */
export function EmptyCanvasCard({
  title = 'Start your diagram',
  description = 'Drag a component from the palette onto the canvas, or press Enter on one to add it here. Then drag from a component’s edge to another to connect them.',
  action = (
    <Button
      variant="primary"
      onClick={() => {
        useUiStore.getState().setLeftTab('palette');
        focusPalette();
      }}
    >
      Open palette
    </Button>
  ),
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <section
        aria-labelledby="empty-canvas-title"
        className="pointer-events-auto flex w-80 flex-col items-center gap-3 rounded-deck-card border border-hairline bg-surface p-6 text-center shadow-float"
      >
        <span className="flex size-10 items-center justify-center rounded-card bg-primary-soft text-primary-ink">
          <Shapes aria-hidden className="size-5" strokeWidth={1.5} />
        </span>
        <h2 id="empty-canvas-title" className="text-title-lg">
          {title}
        </h2>
        <p className="text-body-sm text-ink-secondary">{description}</p>
        {action}
      </section>
    </div>
  );
}
