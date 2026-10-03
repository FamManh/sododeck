import { OctagonX } from 'lucide-react';
import type { CSSProperties } from 'react';

import type { Point } from '../../../lib/landing/geometry';
import { C } from '../../../lib/landing/tokens';

interface EdgeLabelProps {
  at: Point;
  text: string;
  tone?: 'default' | 'current' | 'error' | 'dim';
  style?: CSSProperties;
  className?: string;
}

/** A connector label pill, centred on its point. */
export function EdgeLabel({ at, text, tone = 'default', style, className }: EdgeLabelProps) {
  const current = tone === 'current';
  const error = tone === 'error';
  return (
    <span
      className={className}
      style={{
        position: 'absolute',
        left: at.x,
        top: at.y,
        transform: 'translate(-50%,-50%)',
        whiteSpace: 'nowrap',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        opacity: tone === 'dim' ? 0.25 : 1,
        boxSizing: 'border-box',
        fontSize: 11,
        fontWeight: 600,
        height: 20,
        padding: '0 8px',
        borderRadius: 99,
        background: current ? C.primary : error ? C.claySoft : C.surface,
        color: current ? C.onPrimary : error ? C.clay : C.inkSecondary,
        border: `1.5px solid ${current ? C.primary : error ? C.clay : C.borderStrong}`,
        ...style,
      }}
    >
      {error && <OctagonX aria-hidden size={11} strokeWidth={2.25} />}
      {text}
    </span>
  );
}
