import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

import { useUiStore } from '../../state/ui-store';
import { DRAWER_MAX, DRAWER_MIN } from './shell-geometry';

const STEP = 8;
const BIG_STEP = 40;

/**
 * The drawer's resize grip (018 FR-025, DESIGN.md "Detail drawer"): a vertical separator on the
 * drawer's left edge, 320–560 px. Dragging resizes live and saves once on release; ←/→ (8 px),
 * ⇧←/⇧→ (40 px), Home and End resize from the keyboard.
 */
export function DrawerGrip({ width }: { width: number }) {
  const setDrawerWidth = useUiStore((s) => s.setDrawerWidth);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? BIG_STEP : STEP;
    // The drawer grows to the left: ← widens it.
    const next =
      event.key === 'ArrowLeft'
        ? width + step
        : event.key === 'ArrowRight'
          ? width - step
          : event.key === 'Home'
            ? DRAWER_MIN
            : event.key === 'End'
              ? DRAWER_MAX
              : null;
    if (next === null) return;
    event.preventDefault();
    setDrawerWidth(next, { commit: true });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Not every environment implements pointer capture (jsdom); the drag still works.
    }
    drag.current = { startX: event.clientX, startWidth: width };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current === null) return;
    setDrawerWidth(drag.current.startWidth + drag.current.startX - event.clientX);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current === null) return;
    const next = drag.current.startWidth + drag.current.startX - event.clientX;
    drag.current = null;
    setDrawerWidth(next, { commit: true });
  };

  return (
    <div
      role="separator"
      aria-label="Resize details"
      aria-orientation="vertical"
      aria-valuemin={DRAWER_MIN}
      aria-valuemax={DRAWER_MAX}
      aria-valuenow={width}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={cn(
        'group/grip absolute top-1/2 left-0 z-10 flex h-12 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full',
        focusRing,
      )}
    >
      <span className="h-12 w-1 rounded-full bg-border transition-colors group-hover/grip:bg-primary group-active/grip:bg-primary" />
    </div>
  );
}
