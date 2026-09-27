import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

import { clampPanelHeight, maxPanelHeight, PANEL_MIN } from './panel-height';

const KEY_STEP = 16;

export interface JsonResizeHandleProps {
  height: number;
  /** Height of the main area the panel shares with the canvas. */
  available: number;
  /** Live height while dragging or on a key press (render only, no store write). */
  onChange: (height: number) => void;
  /** Final height: on pointer release and on each key press. */
  onCommit: (height: number) => void;
}

/**
 * The JSON panel's top edge (004 research R7): a WAI-ARIA window splitter. Drag it, or focus it
 * and use ↑/↓ (16 px), Home (minimum) and End (maximum).
 */
export function JsonResizeHandle({ height, available, onChange, onCommit }: JsonResizeHandleProps) {
  const drag = useRef<{ startY: number; startHeight: number; height: number } | null>(null);

  const commit = (next: number) => {
    onChange(next);
    onCommit(next);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const next = {
      ArrowUp: height + KEY_STEP,
      ArrowDown: height - KEY_STEP,
      Home: PANEL_MIN,
      End: maxPanelHeight(available),
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    commit(clampPanelHeight(next, available));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startHeight: height, height };
  };

  const onPointerMove = (event: PointerEvent) => {
    const current = drag.current;
    if (!current) return;
    // Dragging up makes the panel taller.
    current.height = clampPanelHeight(
      current.startHeight + current.startY - event.clientY,
      available,
    );
    onChange(current.height);
  };

  const onPointerEnd = () => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    onCommit(current.height);
  };

  return (
    <div
      role="separator"
      aria-label="Resize JSON panel"
      aria-orientation="horizontal"
      aria-valuenow={height}
      aria-valuemin={PANEL_MIN}
      aria-valuemax={maxPanelHeight(available)}
      tabIndex={0}
      className={cn(
        'absolute inset-x-0 -top-[3px] z-10 h-1.5 cursor-row-resize touch-none',
        focusRing,
      )}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    />
  );
}
