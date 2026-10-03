import { useReactFlow } from '@xyflow/react';
import { useState, type PointerEvent } from 'react';

import { useEditor } from '../../model/use-editor';
import type { Point } from '../canvas-geometry';
import { createFrame } from './frame-actions';
import { clampToMinimum, clickFrame, DRAG_THRESHOLD, rectBetween } from './frame-draw';

interface Drag {
  pointerId: number;
  /** The layer's top-left on screen, for drawing the preview inside it. */
  origin: Point;
  /** Screen (client) points, for the threshold and the preview. */
  startClient: Point;
  client: Point;
  /** Flow points, for the frame itself. */
  startFlow: Point;
  flow: Point;
}

/**
 * The Frame tool's drawing surface (031, contract shape-ui "Frame tool"), mounted by the canvas
 * only while the tool is armed: it covers the canvas with a crosshair; a drag shows a dashed Deck Orange rectangle and a
 * "W × H" readout, release creates the group; a click places a default 320 × 200 frame. Esc
 * (canvas shortcuts) disarms the tool, which unmounts the layer and drops a drag in progress.
 * Nothing is stored until release: the preview is local state of this layer.
 */
export function FrameDrawLayer() {
  const editor = useEditor();
  const { screenToFlowPosition } = useReactFlow();
  const [drag, setDrag] = useState<Drag | null>(null);

  const toFlow = (event: PointerEvent) =>
    screenToFlowPosition({ x: event.clientX, y: event.clientY });
  const preview =
    drag === null
      ? null
      : {
          origin: drag.origin,
          screen: rectBetween(drag.startClient, drag.client),
          flow: clampToMinimum(rectBetween(drag.startFlow, drag.flow)),
        };

  return (
    <div
      data-testid="frame-draw-layer"
      aria-hidden
      className="absolute inset-0 z-10 cursor-crosshair"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const flow = toFlow(event);
        const client = { x: event.clientX, y: event.clientY };
        const box = event.currentTarget.getBoundingClientRect();
        setDrag({
          pointerId: event.pointerId,
          origin: { x: box.left, y: box.top },
          startClient: client,
          client,
          startFlow: flow,
          flow,
        });
      }}
      onPointerMove={(event) => {
        if (drag?.pointerId !== event.pointerId) return;
        setDrag({ ...drag, client: { x: event.clientX, y: event.clientY }, flow: toFlow(event) });
      }}
      onPointerUp={(event) => {
        if (drag?.pointerId !== event.pointerId) return;
        const moved = Math.hypot(
          event.clientX - drag.startClient.x,
          event.clientY - drag.startClient.y,
        );
        setDrag(null);
        createFrame(
          editor,
          moved < DRAG_THRESHOLD
            ? clickFrame(drag.startFlow)
            : rectBetween(drag.startFlow, toFlow(event)),
        );
      }}
      onPointerCancel={() => {
        setDrag(null);
      }}
    >
      {preview !== null && (
        <div
          data-testid="frame-draw-preview"
          className="pointer-events-none absolute rounded-[20px] border-[1.5px] border-dashed border-deck-orange bg-deck-orange-soft/30"
          style={{
            left: preview.screen.x - preview.origin.x,
            top: preview.screen.y - preview.origin.y,
            width: preview.screen.width,
            height: preview.screen.height,
          }}
        >
          <span
            data-testid="frame-draw-readout"
            className="absolute -top-6 left-0 rounded-full bg-primary px-1.5 font-mono text-[10.5px] leading-[18px] whitespace-nowrap text-on-primary"
          >
            {Math.round(preview.flow.width)} × {Math.round(preview.flow.height)}
          </span>
        </div>
      )}
    </div>
  );
}
