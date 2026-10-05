import type { StickyColor } from '@sododeck/schema';
import { cn } from '@sododeck/ui/lib/utils';

import { StickyPaper } from './sticky-paper';

/** Back to front: each sheet sits a little lower and to the side, so they read as a stack. */
const SHEETS = [
  'top-0 left-3 rotate-6 opacity-70',
  'top-1 left-1.5 -rotate-3 opacity-85',
  'top-2 left-0',
] as const;

/**
 * A pad of three offset notes (053 R6): the Sticky tile in the Add flyout. It reuses the note's own
 * paper at a small size, so it follows the colour tokens and both themes. Decorative: the button
 * that holds it has the name.
 */
export function StickyPad({
  color,
  className,
}: {
  color: StickyColor | undefined;
  className?: string;
}) {
  return (
    <span
      data-testid="sticky-pad"
      aria-hidden
      className={cn('relative inline-block h-9 w-10 shrink-0', className)}
    >
      {SHEETS.map((place) => (
        <StickyPaper key={place} color={color} className={cn('absolute size-7', place)} />
      ))}
    </span>
  );
}
