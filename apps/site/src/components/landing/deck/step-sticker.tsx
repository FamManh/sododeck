import { Check } from 'lucide-react';

import { C } from '../../../lib/landing/tokens';

interface StepStickerProps {
  state: 'played' | 'current';
  n: number;
}

/** The corner sticker of a card in a played flow (035): a check once played, the number now. */
export function StepSticker({ state, n }: StepStickerProps) {
  const current = state === 'current';
  const size = current ? 26 : 22;
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: -9,
        top: -9,
        width: size,
        height: size,
        borderRadius: 99,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: current ? 12.5 : 11,
        fontWeight: 700,
        background: current ? C.primary : C.ink,
        color: current ? C.onPrimary : C.surface,
        border: `2px solid ${C.surface}`,
        zIndex: 3,
      }}
    >
      {current ? n : <Check size={12} strokeWidth={3} color={C.surface} />}
    </span>
  );
}
