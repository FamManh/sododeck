import type { LucideIcon } from 'lucide-react';

import { C } from '../../lib/landing/tokens';

/** A small raised tile holding an icon (proof strip, captions, points). */
export function IconTile({ icon: Icon, size = 36 }: { icon: LucideIcon; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: C.surface,
        border: `1.5px solid ${C.borderStrong}`,
        boxShadow: `0 2px 0 0 ${C.borderStrong}`,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: C.ink,
        flex: 'none',
      }}
    >
      <Icon size={17} strokeWidth={1.75} />
    </span>
  );
}
