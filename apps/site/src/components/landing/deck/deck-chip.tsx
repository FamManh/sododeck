import type { ReactNode } from 'react';

import { C, pal, type Hue } from '../../../lib/landing/tokens';

interface DeckChipProps {
  label: string;
  hue?: Hue;
  small?: boolean;
  icon?: ReactNode;
}

/** The filled pill chip of the Deck look (tags, enum values); slate-free chips are neutral. */
export function DeckChip({ label, hue, small = false, icon }: DeckChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: small ? 18 : 21,
        padding: small ? '0 6px' : '0 8px 0 7px',
        borderRadius: 999,
        background: hue === undefined ? C.surface2 : pal(hue, 'chip'),
        color: hue === undefined ? C.inkSecondary : pal(hue, 'ink'),
        fontSize: small ? 10.5 : 11.5,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        flex: 'none',
      }}
    >
      {icon}
      {label}
    </span>
  );
}
