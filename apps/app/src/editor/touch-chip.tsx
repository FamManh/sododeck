import type { TouchChip } from '../db/touches';
import { AccessMarker } from './table/access-marker';

/**
 * The chip a database card (or a collapsed group holding one) shows on the current step (049):
 * "writes orders +1". Paint only, like the step sticker: placed under the card's bottom edge, so it
 * never changes the box or the hit test; the card's accessible name carries the same text.
 */
export function TouchChipBadge({ chip }: { chip: TouchChip }) {
  return (
    <span
      aria-hidden
      data-testid="touch-chip"
      className="pointer-events-none absolute -bottom-[11px] left-1/2 z-10 flex h-[22px] max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-1 rounded-full border border-deck-orange bg-surface px-1.5 text-[11px] leading-none font-semibold whitespace-nowrap text-ink shadow-[0_0_0_2px_var(--color-surface)] select-none"
    >
      <AccessMarker access={chip.access} />
      <span className="truncate">{chip.text}</span>
    </span>
  );
}
