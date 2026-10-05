import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

const STEP = 8;
const BIG_STEP = 40;

export interface DrawerGripProps {
  width: number;
  min: number;
  max: number;
  /** The separator's accessible name. */
  label: string;
  /** Follows the pointer during a drag. */
  onChange: (px: number) => void;
  /** A key press or the end of a drag: the width to keep. */
  onCommit: (px: number) => void;
}

/**
 * A drawer's resize grip (018 FR-025, DESIGN.md "Detail drawer"; shared with the code drawer in
 * 054): a vertical separator on the drawer's left edge between `min` and `max` px. Dragging
 * resizes live and commits once on release; ←/→ (8 px), ⇧←/⇧→ (40 px), Home and End resize from
 * the keyboard.
 */
export function DrawerGrip({ width, min, max, label, onChange, onCommit }: DrawerGripProps) {
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
            ? min
            : event.key === 'End'
              ? max
              : null;
    if (next === null) return;
    event.preventDefault();
    onCommit(next);
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
    onChange(drag.current.startWidth + drag.current.startX - event.clientX);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current === null) return;
    const next = drag.current.startWidth + drag.current.startX - event.clientX;
    drag.current = null;
    onCommit(next);
  };

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
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
