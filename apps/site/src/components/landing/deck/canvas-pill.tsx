import type { CSSProperties, ReactNode } from 'react';

import { C } from '../../../lib/landing/tokens';

interface CanvasPillProps {
  children: ReactNode;
  style?: CSSProperties;
  height?: number;
}

/** A rounded pill floating on the canvas (zoom labels, breadcrumbs, status). */
export function CanvasPill({ children, style, height = 30 }: CanvasPillProps) {
  return (
    <div
      style={{
        position: 'absolute',
        height,
        padding: '0 12px',
        borderRadius: 99,
        background: C.surface,
        border: `1.5px solid ${C.borderStrong}`,
        boxShadow: `0 2px 0 0 ${C.borderStrong}`,
        boxSizing: 'border-box',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        fontSize: 12.5,
        whiteSpace: 'nowrap',
        color: C.ink,
        zIndex: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
