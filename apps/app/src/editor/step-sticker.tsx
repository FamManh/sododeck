import { cn } from '@sododeck/ui/lib/utils';
import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';

import type { StepState } from './flows/step-marks';

interface StepStickerProps {
  state: StepState;
  /** Printed on current and upcoming stickers; played ones show a check. */
  number: string | null;
}

/**
 * The corner sticker of a card in a played flow (035, DESIGN.md "Flow playback"): ✓ once played,
 * the step number on the current card, a dashed disc with its number while upcoming. Paint only:
 * absolutely placed, `pointer-events: none` and `aria-hidden`, so it never changes the card's box,
 * its hit test or its accessible name. The disc size comes from a token, so "10a" scales its text
 * down instead of growing the disc.
 */
export function StepSticker({ state, number }: StepStickerProps) {
  const current = state === 'current';
  const size = current ? 'var(--sd-step-sticker-current)' : 'var(--sd-step-sticker)';
  const style: CSSProperties = {
    width: size,
    height: size,
    fontSize: (number?.length ?? 0) > 2 ? 9 : current ? 12.5 : 11,
  };
  return (
    <span
      aria-hidden="true"
      data-testid="step-sticker"
      data-step-state={state}
      style={style}
      className={cn(
        'sd-step-sticker pointer-events-none absolute -top-[9px] -left-[9px] z-10 flex items-center justify-center overflow-hidden rounded-full font-mono leading-none font-bold select-none',
        state === 'played' && 'bg-ink text-surface shadow-[0_0_0_2px_var(--color-surface)]',
        current && 'bg-deck-orange text-on-primary shadow-[0_0_0_2px_var(--color-surface)]',
        state === 'upcoming' &&
          'border-[1.5px] border-dashed border-ink-secondary bg-surface text-ink-secondary',
      )}
    >
      {state === 'played' ? <Check aria-hidden size={13} strokeWidth={3} /> : number}
    </span>
  );
}
