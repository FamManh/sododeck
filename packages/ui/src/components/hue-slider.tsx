/**
 * The hue bar for the "Add a deck colour" panel (020 T042/T045): a 1D `slider`, 0–359°. ←/→ step
 * by 1°, or 10° with ⇧; pointer drag jumps to the pointer position. Purely controlled.
 */
import { useRef } from 'react';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';

function clampHue(value: number): number {
  return Math.min(359, Math.max(0, Math.round(value)));
}

export interface HueSliderProps {
  hue: number;
  onChange: (next: number) => void;
  className?: string;
}

export function HueSlider({ hue, onChange, className }: HueSliderProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  const updateFromPoint = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect === undefined || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onChange(clampHue(ratio * 359));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPoint(event.clientX);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateFromPoint(event.clientX);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(clampHue(hue + step));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(clampHue(hue - step));
    }
  };

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Hue"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={hue}
      aria-valuetext={`Hue ${String(hue)}°`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
      className={cn(
        'relative h-4 w-full touch-none rounded-full select-none sd-hue-track',
        focusRing,
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full sd-colour-cursor"
        style={{ left: `${String((hue / 359) * 100)}%` }}
      />
    </div>
  );
}
