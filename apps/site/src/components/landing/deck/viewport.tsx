import type { CSSProperties, ReactNode } from 'react';

import { C } from '../../../lib/landing/tokens';

interface ViewportProps {
  /** Frame size; a string (e.g. `'100%'`) makes the frame fluid. */
  width: number | string;
  height: number;
  /** World zoom. */
  scale?: number;
  /** Where the world's origin sits in the frame; strings allow `calc(50% - …)` centring. */
  offsetX?: number | string;
  offsetY?: number;
  worldWidth: number;
  worldHeight: number;
  /** Rounds only the left corners: the frame runs off the page's right edge. */
  bleed?: boolean;
  radius?: number;
  border?: boolean;
  /** Overlays in frame coordinates (labels, panels, players). */
  over?: ReactNode;
  worldStyle?: CSSProperties;
  worldClassName?: string | undefined;
  className?: string;
  label?: string;
  children: ReactNode;
}

const px = (v: number | string): string => (typeof v === 'number' ? `${String(v)}px` : v);

/**
 * A crop of the dotted canvas: the world is drawn at `scale` with its origin at the offset, and
 * the frame clips it. The dot grid scales and moves with the world.
 */
export function Viewport({
  width,
  height,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
  worldWidth,
  worldHeight,
  bleed = false,
  radius = 20,
  border = true,
  over,
  worldStyle,
  worldClassName,
  className,
  label,
  children,
}: ViewportProps) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width,
        height,
        flex: 'none',
        overflow: 'hidden',
        borderRadius: bleed ? `${String(radius)}px 0 0 ${String(radius)}px` : radius,
        background: C.canvas,
        backgroundImage: `radial-gradient(${C.dot} ${String(1.6 * scale)}px, transparent ${String(1.9 * scale)}px)`,
        backgroundSize: `${String(26 * scale)}px ${String(26 * scale)}px`,
        backgroundPosition: `${px(offsetX)} ${px(offsetY)}`,
        boxShadow: border ? `inset 0 0 0 1.5px ${C.borderStrong}` : 'none',
        boxSizing: 'border-box',
        isolation: 'isolate',
        color: C.ink,
        maxWidth: '100%',
      }}
    >
      <div
        // The world is a picture: its label describes it, and overlays (panels, players) stay
        // readable on their own.
        role={label === undefined ? undefined : 'img'}
        aria-label={label}
        className={worldClassName}
        style={{
          position: 'absolute',
          left: offsetX,
          top: offsetY,
          width: worldWidth,
          height: worldHeight,
          transform: scale === 1 ? undefined : `scale(${String(scale)})`,
          transformOrigin: '0 0',
          ...worldStyle,
        }}
      >
        {children}
      </div>
      {over}
    </div>
  );
}
