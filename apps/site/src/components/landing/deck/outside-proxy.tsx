import type { ProxyData } from '../../../lib/landing/checkout-deck';
import { DECK } from '../../../lib/landing/geometry';
import { C } from '../../../lib/landing/tokens';
import { TYPE_STYLE } from './type-style';

/** A dashed stand-in for a card outside the current crop or group (034 drill-in). */
export function OutsideProxy({ proxy }: { proxy: ProxyData }) {
  const Icon = TYPE_STYLE[proxy.type].icon;
  return (
    <div
      style={{
        width: proxy.w,
        height: DECK.proxyHeight,
        boxSizing: 'border-box',
        border: `1.5px dashed ${C.inkSecondary}`,
        borderRadius: DECK.radius,
        background: C.canvas,
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        color: C.ink,
      }}
    >
      <Icon
        aria-hidden
        size={13}
        strokeWidth={1.75}
        color={C.inkSecondary}
        style={{ flex: 'none' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{proxy.title}</span>
        <span style={{ fontSize: 10, color: C.muted }}>Outside</span>
      </div>
    </div>
  );
}
