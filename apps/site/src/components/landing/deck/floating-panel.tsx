import type { CSSProperties, ReactNode } from 'react';

import { C, PANEL_SHADOW } from '../../../lib/landing/tokens';

interface FloatingPanelProps {
  style?: CSSProperties;
  className?: string | undefined;
  children: ReactNode;
}

/** A floating panel of the Deck look: surface, strong border, a lip and a soft drop. */
export function FloatingPanel({ style, className, children }: FloatingPanelProps) {
  return (
    <div
      className={className}
      style={{
        background: C.surface,
        border: `1.5px solid ${C.borderStrong}`,
        borderRadius: 16,
        boxShadow: PANEL_SHADOW,
        color: C.ink,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
