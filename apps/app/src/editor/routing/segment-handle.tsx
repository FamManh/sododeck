/**
 * The movable middle segment's drag handle (017 R7, FR-012): a 10 × 24 slider at the segment's
 * midpoint, rotated to the segment's own moving axis (DESIGN.md "Resize handle" family). Shown
 * only for the single selected connector, when editing is allowed, and only when the resolved
 * sides face each other (a route with a movable segment) — `deck-edge.tsx` gates all of that and
 * passes down only `segment` and the edge's current offset.
 */
import { EdgeLabelRenderer, useReactFlow } from '@xyflow/react';
import type { Id } from '@sododeck/schema';
import { useRef, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import type { Level } from '../levels';
import {
  applySegmentDrag,
  endSegmentDrag,
  startSegmentDrag,
  type SegmentDragSession,
} from '../editing/segment-drag';
import type { RouteSegment } from './route-path';

/** Same step as ⌥(⇧) + arrow on the canvas (016 R8, T048): 1 px, or 10 with ⇧. */
const STEP = 1;
const STEP_SHIFT = 10;

export interface SegmentHandleProps {
  edgeId: Id;
  level: Level;
  segment: RouteSegment;
  offset: number;
}

/** The segment's own midpoint: centred on its fixed extent, at its position on the moving axis. */
function midpointOf(segment: RouteSegment): { x: number; y: number } {
  const mid = (segment.from + segment.to) / 2;
  return segment.axis === 'vertical' ? { x: mid, y: segment.at } : { x: segment.at, y: mid };
}

export function SegmentHandle({ edgeId, level, segment, offset }: SegmentHandleProps) {
  const editor = useEditor();
  const { getZoom, screenToFlowPosition } = useReactFlow();
  const session = useRef<SegmentDragSession | null>(null);
  const [active, setActive] = useState(false);
  const { x, y } = midpointOf(segment);
  const vertical = segment.axis === 'vertical';

  /** One arrow-key press: a full drag lifecycle, so it is its own undo step (T035; the burst
   * grouping of held arrows is the canvas-level shortcut's job, T048). */
  function step(delta: number): void {
    const started = startSegmentDrag(editor, edgeId, level);
    if (started === null) return;
    const at = started.automaticAt + started.last + delta;
    const pointer = segment.axis === 'vertical' ? { x, y: at } : { x: at, y };
    applySegmentDrag(editor, started, pointer, { mod: true }, 1);
    endSegmentDrag(editor, started);
  }

  return (
    <EdgeLabelRenderer>
      <div
        role="slider"
        aria-label="Move middle segment"
        aria-valuenow={Math.round(offset)}
        aria-orientation={segment.axis}
        tabIndex={0}
        data-testid="segment-handle"
        data-axis={segment.axis}
        {...(active ? { 'data-active': '' } : {})}
        className="sd-segment-handle nodrag nopan absolute"
        style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
        onPointerDown={(event) => {
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          session.current = startSegmentDrag(editor, edgeId, level);
          setActive(session.current !== null);
        }}
        onPointerMove={(event) => {
          if (session.current === null) return;
          const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          applySegmentDrag(
            editor,
            session.current,
            point,
            { mod: event.metaKey || event.ctrlKey },
            getZoom(),
          );
        }}
        onPointerUp={() => {
          if (session.current === null) return;
          endSegmentDrag(editor, session.current);
          session.current = null;
          setActive(false);
        }}
        onKeyDown={(event) => {
          const delta = event.shiftKey ? STEP_SHIFT : STEP;
          const key = event.key;
          const moves = vertical
            ? key === 'ArrowUp' || key === 'ArrowDown'
            : key === 'ArrowLeft' || key === 'ArrowRight';
          if (!moves) return;
          event.preventDefault();
          event.stopPropagation();
          step(key === 'ArrowUp' || key === 'ArrowLeft' ? -delta : delta);
        }}
      />
    </EdgeLabelRenderer>
  );
}
