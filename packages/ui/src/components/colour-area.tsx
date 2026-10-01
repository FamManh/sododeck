/**
 * The saturation/brightness box for the "Add a deck colour" panel (020 T042/T045, contract "Add a
 * deck colour"): a 2D `slider` over the hue's gradient. Saturation moves ←/→, brightness ↑/↓, 1 %
 * per press or 10 % with ⇧; pointer drag updates both at once. Purely controlled: the caller owns
 * `hue`/`saturation`/`value` (HSV) and receives `{ s, v }` patches.
 */
import { useRef } from 'react';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface ColourAreaProps {
  /** Hue in [0, 360): only the gradient background, not part of `onChange`. */
  hue: number;
  saturation: number;
  value: number;
  onChange: (next: { s: number; v: number }) => void;
  className?: string;
}

function valuetext(s: number, v: number): string {
  return `Saturation ${String(Math.round(s * 100))} %, brightness ${String(Math.round(v * 100))} %`;
}

export function ColourArea({ hue, saturation, value, onChange, className }: ColourAreaProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  const updateFromPoint = (clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect === undefined || rect.width === 0 || rect.height === 0) return;
    const s = clamp01((clientX - rect.left) / rect.width);
    // Brightness is 1 at the top, 0 at the bottom.
    const v = clamp01(1 - (clientY - rect.top) / rect.height);
    onChange({ s: round2(s), v: round2(v) });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPoint(event.clientX, event.clientY);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateFromPoint(event.clientX, event.clientY);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        onChange({ s: round2(clamp01(saturation + step)), v: value });
        break;
      case 'ArrowLeft':
        event.preventDefault();
        onChange({ s: round2(clamp01(saturation - step)), v: value });
        break;
      case 'ArrowUp':
        event.preventDefault();
        onChange({ s: saturation, v: round2(clamp01(value + step)) });
        break;
      case 'ArrowDown':
        event.preventDefault();
        onChange({ s: saturation, v: round2(clamp01(value - step)) });
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Saturation and brightness"
      aria-valuetext={valuetext(saturation, value)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
      style={{ '--hue': hue } as React.CSSProperties}
      className={cn(
        'sd-colour-area relative h-32 w-full touch-none rounded-input select-none',
        focusRing,
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute size-3 -translate-x-1/2 translate-y-1/2 rounded-full select-none sd-colour-cursor"
        style={{ left: `${String(saturation * 100)}%`, bottom: `${String(value * 100)}%` }}
      />
    </div>
  );
}
