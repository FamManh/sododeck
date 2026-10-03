/**
 * The handles of the selected connector (022 US2, frame 129): a filled dot on every bend and a
 * ring at the midpoint of every hop. Dragging a midpoint adds a bend where it is dropped,
 * dragging a bend moves it, ⌫ / Delete / double-click removes it. All are focusable buttons
 * (Tab order: midpoints and bends along the line); arrows move a bend by a grid step (Shift: 1 px).
 * Straight lines have no bends, so they show none. Live positions live in the UI store; the
 * document is written once, on release (`editing/bend-drag.ts`).
 */
import type { Side } from '@sododeck/schema';
import { EdgeLabelRenderer, useReactFlow } from '@xyflow/react';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { anchorReadout, stepAnchor } from '../editing/anchor-drag';
import { oneStep } from '../fields/one-step';
import {
  addBendAt,
  BEND_STEP,
  BEND_STEP_FINE,
  endBendDrag,
  moveBend,
  nudgeBend,
  removeBend,
  startBendDrag,
  type BendContext,
  type BendSession,
  type BendTarget,
} from '../editing/bend-drag';
import type { Point } from './route-path';

/** Where each end sits on its card, for the keyboard (the pointer slides ends through React Flow). */
export interface EndAnchors {
  fromSide: Side;
  fromAt: number;
  toSide: Side;
  toAt: number;
}

export interface RouteHandlesProps {
  context: BendContext;
  anchors?: EndAnchors;
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Moves keyboard focus back to the connector itself (Esc on a handle). */
function focusConnector(edgeId: string): void {
  document
    .querySelector<HTMLElement>(`.react-flow__edge[data-id="${CSS.escape(edgeId)}"]`)
    ?.focus();
}

export function RouteHandles({ context, anchors }: RouteHandlesProps) {
  const editor = useEditor();
  const { getZoom, screenToFlowPosition } = useReactFlow();
  const session = useRef<BendSession | null>(null);
  const [active, setActive] = useState<{ key: string; index: number } | null>(null);
  const preview = useUiStore((s) =>
    s.bendPreview?.edgeId === context.edgeId ? s.bendPreview : null,
  );
  const readout = useUiStore((s) => (preview === null ? null : s.connectorReadout));

  const bends = preview?.bends ?? context.bends;
  const points = [context.start, ...bends, context.end];
  const live: BendContext = { ...context, bends };
  const dragging = active !== null;

  function begin(event: PointerEvent<HTMLElement>, key: string, target: BendTarget) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    session.current = startBendDrag(editor, context, target);
    setActive({ key, index: target.index });
  }
  function drag(event: PointerEvent<HTMLElement>) {
    if (session.current === null) return;
    moveBend(session.current, screenToFlowPosition({ x: event.clientX, y: event.clientY }), {
      mod: event.metaKey || event.ctrlKey,
      zoom: getZoom(),
    });
  }
  function end() {
    if (session.current === null) return;
    endBendDrag(editor, session.current);
    session.current = null;
    setActive(null);
  }

  function bendKeys(event: KeyboardEvent<HTMLElement>, index: number) {
    const step = event.shiftKey ? BEND_STEP_FINE : BEND_STEP;
    const arrows: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const delta = arrows[event.key];
    if (delta !== undefined) nudgeBend(editor, live, index, delta);
    else if (event.key === 'Backspace' || event.key === 'Delete') removeBend(editor, live, index);
    else if (event.key === 'Escape') focusConnector(context.edgeId);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  /** ← / ↑ and → / ↓ move an end one stop along its side, onto the next side at a corner. */
  function endKeys(event: KeyboardEvent<HTMLElement>, end: 'source' | 'target') {
    if (anchors === undefined) return;
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    if (event.key === 'Escape') focusConnector(context.edgeId);
    else if (!back && !forward) return;
    else {
      const [side, at] =
        end === 'source' ? [anchors.fromSide, anchors.fromAt] : [anchors.toSide, anchors.toAt];
      const next = stepAnchor(side, at, forward ? 1 : -1);
      oneStep(editor, () => {
        editor.setEdgeRoute(
          context.edgeId,
          end === 'source'
            ? { fromSide: next.side, fromAt: next.at }
            : { toSide: next.side, toAt: next.at },
        );
      });
      useUiStore.getState().announce(`Anchor ${anchorReadout(next.side, next.at)}`);
    }
    event.preventDefault();
    event.stopPropagation();
  }

  const placed = (point: Point) => ({
    left: point.x,
    top: point.y,
    transform: 'translate(-50%, -50%)',
  });

  return (
    <EdgeLabelRenderer>
      {anchors !== undefined &&
        (['source', 'target'] as const).map((end) => (
          <button
            key={end}
            type="button"
            aria-label={end === 'source' ? 'Source end' : 'Target end'}
            data-kind="end"
            data-testid={`route-end-${end}`}
            className="sd-route-handle nodrag nopan absolute"
            // The pointer drags ends through React Flow's reconnect anchors underneath.
            style={{
              ...placed(end === 'source' ? context.start : context.end),
              pointerEvents: 'none',
            }}
            onKeyDown={(event) => {
              endKeys(event, end);
            }}
          />
        ))}
      {points.slice(0, -1).map((from, i) => {
        const to = points[i + 1];
        if (to === undefined || dragging) return null;
        const at = mid(from, to);
        return (
          <button
            key={`mid-${String(i)}`}
            type="button"
            aria-label={`Add bend between points ${String(i + 1)} and ${String(i + 2)}`}
            data-kind="midpoint"
            data-testid="route-midpoint"
            className="sd-route-handle nodrag nopan absolute"
            style={placed(at)}
            onPointerDown={(event) => {
              begin(event, `mid-${String(i)}`, { kind: 'add', index: i, at });
            }}
            onPointerMove={drag}
            onPointerUp={end}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                addBendAt(editor, live, i, at);
                event.preventDefault();
                event.stopPropagation();
              } else if (event.key === 'Escape') {
                focusConnector(context.edgeId);
                event.stopPropagation();
              }
            }}
          />
        );
      })}
      {bends.map((bend, i) => (
        <button
          key={`bend-${String(i)}`}
          type="button"
          aria-label={`Bend ${String(i + 1)} of ${String(bends.length)}`}
          data-kind="bend"
          data-testid="route-bend"
          {...(active?.key === `bend-${String(i)}` ? { 'data-active': '' } : {})}
          className="sd-route-handle nodrag nopan absolute"
          style={placed(bend)}
          onPointerDown={(event) => {
            begin(event, `bend-${String(i)}`, { kind: 'move', index: i });
          }}
          onPointerMove={drag}
          onPointerUp={end}
          onDoubleClick={() => {
            removeBend(editor, live, i);
          }}
          onKeyDown={(event) => {
            bendKeys(event, i);
          }}
        />
      ))}
      {readout !== null && preview !== null && active !== null && (
        <span
          className="sd-route-readout"
          data-testid="route-readout"
          aria-hidden
          style={{
            left: (preview.bends[active.index] ?? context.end).x + 14,
            top: (preview.bends[active.index] ?? context.end).y + 14,
          }}
        >
          {readout} · {String(bends.length)} {bends.length === 1 ? 'bend' : 'bends'}
        </span>
      )}
    </EdgeLabelRenderer>
  );
}
