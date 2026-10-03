import { ChevronDown } from 'lucide-react';
import type { CSSProperties } from 'react';

import type { SceneFrame } from '../../../lib/landing/checkout-deck';
import { C, pal } from '../../../lib/landing/tokens';

interface GroupFrameProps {
  frame: SceneFrame;
  style?: CSSProperties;
  className?: string;
}

/** An open group (frame 119): a soft panel with its name pill and card count on the top edge. */
export function GroupFrame({ frame, style, className }: GroupFrameProps) {
  const line = frame.color === undefined ? C.borderStrong : pal(frame.color, 'stroke');
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        left: frame.x,
        top: frame.y,
        width: frame.w,
        height: frame.h,
        boxSizing: 'border-box',
        border: `1.5px solid ${line}`,
        borderRadius: 20,
        background: frame.color === undefined ? C.surface2 : pal(frame.color, 'fill'),
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: -14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          padding: '0 6px 0 10px',
          borderRadius: 99,
          background: C.surface,
          border: `1.5px solid ${line}`,
          boxShadow: `0 2px 0 0 ${line}`,
          boxSizing: 'border-box',
          fontSize: 12.5,
          fontWeight: 600,
          color: C.ink,
          whiteSpace: 'nowrap',
        }}
      >
        <ChevronDown aria-hidden size={13} strokeWidth={2.25} color={C.inkSecondary} />
        {frame.title}
        <span
          style={{
            minWidth: 18,
            height: 18,
            borderRadius: 99,
            background: C.ink,
            color: C.surface,
            fontSize: 10.5,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5px',
            boxSizing: 'border-box',
          }}
        >
          {frame.count}
        </span>
      </div>
    </div>
  );
}
