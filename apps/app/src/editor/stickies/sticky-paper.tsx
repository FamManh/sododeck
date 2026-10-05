import { cn } from '@sododeck/ui/lib/utils';
import type { StickyColor } from '@sododeck/schema';
import type * as React from 'react';

import { stickyTintClass } from './sticky-tint';

/**
 * The look of a note (053 R6): a sheet of paper with a soft shadow, a light vertical gradient and a
 * lifted bottom-right corner. No header, icon or lip. It takes its colour from the five sticky
 * tints and everything else from tokens, so both themes work; the note on the canvas and the pad
 * tile in the Add flyout share it.
 */
export function StickyPaper({
  color,
  lifted = false,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  color: StickyColor | undefined;
  /** Selected or dragged: the shadow lifts. */
  lifted?: boolean;
}) {
  return (
    <div
      data-slot="sticky-paper"
      data-color={color ?? 'amber'}
      className={cn(
        'relative overflow-hidden rounded-[6px] border',
        stickyTintClass(color),
        lifted ? 'shadow-note-lift' : 'shadow-note',
        // The gradient: a lighter top, so the sheet reads as lit from above.
        'before:pointer-events-none before:absolute before:inset-0 before:bg-linear-to-b before:from-surface/35 before:to-transparent',
        // The lifted corner: a folded triangle in a darker tint of the ink.
        'after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:size-4 after:bg-[linear-gradient(135deg,transparent_50%,color-mix(in_srgb,var(--color-ink)_14%,transparent)_50%)] after:rounded-tl-[4px]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
