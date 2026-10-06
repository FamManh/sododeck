import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { RotateCw } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { startPointerDrag, type PointerDrag } from '../editing/pointer-drag';
import { oneStep } from '../fields/one-step';
import { ROTATION_STEP, rotationFromPointer, rotationPatch, stepRotation } from './text-rotation';

/** The CSS variable the shape's turned parts read (`.sd-shape-turn` in index.css). */
export const TURN_VAR = '--sd-turn';

/**
 * The rotate handle of a selected text (founder feedback, 2026-10-06, ADR 0043): a round knob
 * below the box (the selection toolbar floats above). Dragging turns the words around the box centre (whole degrees, 15° steps with
 * Shift), previewed through the CSS variable on the shape and written once on release. It is a
 * slider for the keyboard: ←/→ turn by 15° (1° with Shift), Home turns it back. Each write is one
 * undo step.
 */
export function RotateHandle({
  id,
  rotation,
  tabIndex,
}: {
  id: string;
  rotation: number;
  tabIndex: number;
}) {
  const editor = useEditor();
  const drag = useRef<PointerDrag | null>(null);
  useEffect(
    () => () => {
      drag.current?.cancel();
    },
    [],
  );

  const write = (degrees: number) => {
    const next = rotationPatch(degrees);
    if ((next ?? 0) === rotation) return;
    oneStep(editor, () => {
      editor.update('nodes', id, { rotation: next });
    });
    useUiStore.getState().announce(`Rotated to ${String(next ?? 0)}°`);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // The knob turns the text; it must not start a card drag, a pan or a marquee.
    event.stopPropagation();
    event.preventDefault();
    const shape = event.currentTarget.closest<HTMLElement>('.sd-shape');
    if (shape === null) return;
    const box = shape.getBoundingClientRect();
    const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    let value = rotation;
    drag.current = startPointerDrag(event, {
      onMove: (move) => {
        value = rotationFromPointer(centre, { x: move.clientX, y: move.clientY }, move.shiftKey);
        shape.style.setProperty(TURN_VAR, `${String(value)}deg`);
      },
      onEnd: (_end, committed) => {
        drag.current = null;
        if (committed) write(value);
      },
      onCancel: () => {
        drag.current = null;
        shape.style.setProperty(TURN_VAR, `${String(rotation)}deg`);
      },
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 1 : ROTATION_STEP;
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? stepRotation(rotation, step)
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? stepRotation(rotation, -step)
          : event.key === 'Home'
            ? 0
            : null;
    if (next === null) return;
    // The canvas's own arrow keys move the selection; here they turn the text.
    event.preventDefault();
    event.stopPropagation();
    write(next);
  };

  return (
    <div
      role="slider"
      aria-label="Rotate text"
      aria-valuemin={-180}
      aria-valuemax={180}
      aria-valuenow={rotation}
      aria-valuetext={`${String(rotation)}°`}
      aria-orientation="horizontal"
      tabIndex={tabIndex}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={(event) => {
        // A double-click turns it back, and must not start the title edit underneath.
        event.stopPropagation();
        write(0);
      }}
      className={cn(
        'sd-rotate-handle nodrag nopan absolute -bottom-7 left-1/2 flex size-[18px] -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-[1.5px] border-primary bg-surface text-primary shadow-rest hover:bg-primary-soft active:cursor-grabbing',
        focusRing,
      )}
    >
      <RotateCw aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-2.5" />
    </div>
  );
}
