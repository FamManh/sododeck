import type { TouchAccess } from '@sododeck/model';
import { cn } from '@sododeck/ui/lib/utils';

/**
 * Read / write marker of a flow step touch (049): a letter in a shape, so the two differ without
 * colour (and in greyscale). W is a filled square, R an outlined circle. Decorative: the row or
 * card says "reads" / "writes" in its accessible name.
 */
export function AccessMarker({ access, className }: { access: TouchAccess; className?: string }) {
  const write = access === 'write';
  return (
    <span
      aria-hidden
      data-access={access}
      className={cn(
        'inline-flex size-[14px] shrink-0 items-center justify-center font-mono text-[9.5px] leading-none font-bold select-none',
        write
          ? 'rounded-[3px] bg-deck-orange text-on-primary'
          : 'rounded-full border-[1.5px] border-deck-orange-ink bg-surface text-deck-orange-ink',
        className,
      )}
    >
      {write ? 'W' : 'R'}
    </span>
  );
}
