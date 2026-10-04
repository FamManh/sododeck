import { Button } from '@sododeck/ui/components/button';
import { Shapes } from 'lucide-react';
import type { ReactNode } from 'react';

import { useUiStore } from '../state/ui-store';
import { focusPalette } from './canvas-actions';

/** Shown on an empty deck (design 37): how to start, and a way to the palette. */
export function EmptyCanvasCard({
  title = 'Start your diagram',
  description = 'Open the palette (C) and drag a component onto the canvas, or press Enter on one to add it here. Then drag from a component’s edge to another to connect them.',
  action = (
    <Button
      variant="primary"
      onClick={() => {
        // The palette flyout beside the rail (018); it takes focus when it opens.
        useUiStore.getState().openFlyout('palette');
        requestAnimationFrame(focusPalette);
      }}
    >
      Add component
    </Button>
  ),
  onAddTable,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  /** With the Database pack on (043 R12): a second way to start, a table with an `id` key. */
  onAddTable?: () => void;
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
        {onAddTable === undefined ? (
          action
        ) : (
          <span className="flex flex-wrap justify-center gap-2">
            {action}
            <Button variant="secondary" onClick={onAddTable}>
              Add table
            </Button>
          </span>
        )}
      </section>
    </div>
  );
}
