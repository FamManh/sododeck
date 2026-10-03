import { List } from 'lucide-react';

import type { EnumData } from '../../../lib/landing/checkout-deck';
import { TABLE } from '../../../lib/landing/geometry';
import { enumGeometry } from '../../../lib/landing/schema';
import { C, FONT_MONO, pal } from '../../../lib/landing/tokens';
import { DeckChip } from './deck-chip';

/** An enum card: its name and its values as coloured chips. */
export function EnumCard({ data }: { data: EnumData }) {
  const g = enumGeometry(data);
  return (
    <div
      style={{
        width: g.w,
        height: g.h,
        boxSizing: 'border-box',
        background: C.surface,
        border: `1.5px solid ${C.borderStrong}`,
        borderRadius: 14,
        boxShadow: `0 3px 0 0 ${C.borderStrong}`,
        padding: TABLE.pad,
        display: 'flex',
        flexDirection: 'column',
        gap: TABLE.gap,
        color: C.ink,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 24 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            background: pal(data.color, 'chip'),
            color: pal(data.color, 'ink'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <List aria-hidden size={14} strokeWidth={2} />
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: C.muted, flex: 1 }}>Enum</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.muted }}>
          {data.values.length} values
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, height: 18, lineHeight: '18px' }}>
        {data.name}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {data.values.map(([value, hue]) => (
          <DeckChip key={value} label={value} hue={hue} small />
        ))}
      </div>
    </div>
  );
}
