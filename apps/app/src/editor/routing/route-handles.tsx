/**
 * The handles of the selected connector (022 US2, frame 129): a filled dot on every bend and a
 * ring at the midpoint of every hop. Dragging a midpoint adds a bend where it is dropped,
 * dragging a bend moves it, ⌫ / Delete / double-click removes it. All are focusable buttons
 * (Tab order: midpoints and bends along the line); arrows move a bend by a grid step (Shift: 1 px).
 * Straight lines have no bends, so they show none. Live positions live in the UI store; the
 * document is written once, on release (`editing/bend-drag.ts`).
 *
 * 050 R1/R2: the handles render in the viewport portal, above every card, and each drag runs
 * through `startPointerDrag`, so it keeps following the pointer while handles re-render and a
 * press below the drag threshold changes nothing. Midpoints are left out on runs shorter than
 * 24 screen px (FR-004).
 *
 * 050 R3: the two end handles sit at the drawn ends and drag them along the card outline or onto
 * another card (`editing/endpoint-drag.ts`); arrows step an end to the next stop, Shift + arrow
 * nudges it 1 %. A straight connector shows only its ends.
 *
 * 050 R7: on an elbow connector (a `segment` context is given) a segment handle sits in the
 * middle of every straight run instead of the midpoints. Dragging it moves the whole run along
 * its normal (`editing/segment-drag.ts`); arrows move it on that axis, ⌫ / double-click reset it.
 */
import type { Id, Side } from '@sododeck/schema';
import { useReactFlow, useStore, ViewportPortal, type ReactFlowState } from '@xyflow/react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { anchorReadout, stepAnchor } from '../editing/anchor-drag';
import {
  cancelEndpointDrag,
  endEndpointDrag,
  moveEndpoint,
  startEndpointDrag,
  type EndpointSession,
} from '../editing/endpoint-drag';
import { endpointIdOf } from '../deck-to-flow';
import { oneStep } from '../fields/one-step';
import {
  addBendAt,
  BEND_STEP,
  BEND_STEP_FINE,
  cancelBendDrag,
  endBendDrag,
  moveBend,
  nudgeBend,
  removeBend,
  startBendDrag,
  type BendContext,
  type BendSession,
  type BendTarget,
} from '../editing/bend-drag';
import { startPointerDrag, type PointerDrag } from '../editing/pointer-drag';
import {
  cancelSegmentDrag,
  endSegmentDrag,
  moveSegment,
  nudgeSegment,
  resetSegment,
  SEGMENT_STEP,
  SEGMENT_STEP_FINE,
  segmentVertices,
  startSegmentDrag,
  type SegmentContext,
  type SegmentSession,
} from '../editing/segment-drag';
import { elbowRuns, runMidpoint, type Run } from './elbow-runs';
import { targetScene } from './endpoint-target';
import { nudgeAnchor } from './outline-attach';
import type { Point } from './route-path';

/** Where each end sits on its card (resolved sides), for the keyboard. */
export interface EndAnchors {
  fromSide: Side;
  fromAt: number;
  toSide: Side;
  toAt: number;
}

/** What the two ends are attached to, and their stored pins (no side = automatic), for drags. */
export interface EndTargets {
  /** The drawn node ids (`group:` prefixed for a group end). */
  source: Id;
  target: Id;
  fromSide?: Side | undefined;
  fromAt?: number | undefined;
  toSide?: Side | undefined;
  toAt?: number | undefined;
}

export interface RouteHandlesProps {
  context: BendContext;
  anchors?: EndAnchors;
  /** Without it the ends are keyboard-only. */
  ends?: EndTargets;
  /** Bends and midpoints: false for a straight connector, which shows only its ends. */
  bendable?: boolean;
  /**
   * An elbow connector's ends as drawn (boxes, sides, `at`) on top of `context`: segment handles
   * then replace the midpoints. `start` / `end` / `fromAt` / `toAt` follow a live drag.
   */
  segment?: SegmentContext;
}

/** FR-004: runs shorter than this on screen get no midpoint or segment handle. */
export const MIN_HANDLE_RUN = 24;

const zoomSelector = (s: ReactFlowState) => s.transform[2];

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Where a moving run's readout sits: the middle of that run, or the line end if it merged away. */
function segmentReadoutAt(vertices: readonly Point[], index: number): Point {
  const from = vertices[index];
  const to = vertices[index + 1];
  return from === undefined || to === undefined
    ? (vertices.at(-1) ?? { x: 0, y: 0 })
    : mid(from, to);
}

/** Moves keyboard focus back to the connector itself (Esc on a handle). */
function focusConnector(edgeId: string): void {
  document
    .querySelector<HTMLElement>(`.react-flow__edge[data-id="${CSS.escape(edgeId)}"]`)
    ?.focus();
}

export function RouteHandles({
  context,
  anchors,
  ends,
  bendable = true,
  segment,
}: RouteHandlesProps) {
  const editor = useEditor();
  const { getNodes, getZoom, screenToFlowPosition } = useReactFlow();
  // Only the selected connector draws handles, so following the zoom here is cheap.
  const zoom = useStore(zoomSelector);
  const session = useRef<BendSession | null>(null);
  const endSession = useRef<EndpointSession | null>(null);
  const segSession = useRef<SegmentSession | null>(null);
  const drag = useRef<PointerDrag | null>(null);
  const [active, setActive] = useState<{ key: string; index: number } | null>(null);
  const preview = useUiStore((s) =>
    s.bendPreview?.edgeId === context.edgeId ? s.bendPreview : null,
  );
  const endPreview = useUiStore((s) =>
    s.endpointPreview?.edgeId === context.edgeId ? s.endpointPreview : null,
  );
  const readout = useUiStore((s) =>
    preview === null && endPreview === null ? null : s.connectorReadout,
  );

  // The segment handles sit on the drawn elbow, live during any drag of this connector.
  const liveSegment: SegmentContext | null =
    segment === undefined ? null : { ...segment, bends: preview?.bends ?? segment.bends };
  const vertices = liveSegment === null ? [] : segmentVertices(liveSegment);
  const runs = liveSegment === null ? [] : elbowRuns(vertices, MIN_HANDLE_RUN, zoom);
  const segmentDrag = active?.key.startsWith('seg-') === true;
  // While a run moves, the bend dots follow the drawn corners (an end-run drag stores none).
  const bends = !bendable
    ? []
    : segmentDrag
      ? vertices.slice(1, -1)
      : (preview?.bends ?? context.bends);
  // Elbow connectors get segment handles instead of midpoints (050 contract UI).
  const points = bendable && segment === undefined ? [context.start, ...bends, context.end] : [];
  const live: BendContext = { ...context, bends };
  const dragging = active !== null;
  /** During a drag every other handle stays mounted but out of reach (and of the a11y tree). */
  const inertUnless = (key: string) =>
    dragging && active.key !== key
      ? { 'aria-hidden': true as const, inert: true, tabIndex: -1 }
      : {};

  // A drag outlives re-renders (window listeners), but not the handles: unmount cancels it.
  useEffect(
    () => () => {
      drag.current?.cancel();
    },
    [],
  );

  /**
   * Press on a bend or midpoint. Nothing changes until the pointer passes the drag threshold, so
   * a click adds no bend (FR-003); then the bend follows the pointer wherever it goes (FR-002).
   */
  function begin(event: PointerEvent<HTMLElement>, key: string, target: BendTarget) {
    if (event.button !== 0) return;
    event.stopPropagation();
    drag.current?.cancel();
    const start = context;
    drag.current = startPointerDrag(event, {
      onStart: () => {
        session.current = startBendDrag(editor, start, target);
        setActive({ key, index: target.index });
      },
      onMove: (e) => {
        if (session.current === null) return;
        moveBend(session.current, screenToFlowPosition({ x: e.clientX, y: e.clientY }), {
          mod: e.metaKey || e.ctrlKey,
          zoom: getZoom(),
        });
      },
      onEnd: () => {
        const s = session.current;
        finish();
        if (s !== null) endBendDrag(editor, s);
      },
      onCancel: () => {
        const s = session.current;
        finish();
        if (s === null || s.cancelled) return;
        cancelBendDrag(s);
        useUiStore.getState().announce('Cancelled');
      },
    });
  }
  function finish() {
    drag.current = null;
    session.current = null;
    endSession.current = null;
    segSession.current = null;
    setActive(null);
  }

  /**
   * Press on a segment handle (050 R7). The run starts moving after the threshold and keeps its
   * distance to the press point, so it never jumps; a click writes nothing.
   */
  function beginSegment(event: PointerEvent<HTMLElement>, run: Run) {
    if (event.button !== 0 || segment === undefined) return;
    event.stopPropagation();
    drag.current?.cancel();
    const ctx = segment;
    const pressed = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    drag.current = startPointerDrag(event, {
      onStart: () => {
        segSession.current = startSegmentDrag(editor, ctx, run, pressed);
        setActive({ key: `seg-${String(run.index)}`, index: run.index });
      },
      onMove: (e) => {
        if (segSession.current === null) return;
        moveSegment(segSession.current, screenToFlowPosition({ x: e.clientX, y: e.clientY }), {
          mod: e.metaKey || e.ctrlKey,
          zoom: getZoom(),
        });
      },
      onEnd: () => {
        const s = segSession.current;
        finish();
        if (s !== null) endSegmentDrag(editor, s);
      },
      onCancel: () => {
        const s = segSession.current;
        finish();
        if (s === null || s.cancelled) return;
        cancelSegmentDrag(s);
        useUiStore.getState().announce('Cancelled');
      },
    });
  }

  /** Arrows on the run's own axis move it (Shift: 1 px); ⌫ / Delete reset it. */
  function segmentKeys(event: KeyboardEvent<HTMLElement>, run: Run) {
    if (segment === undefined) return;
    const step = event.shiftKey ? SEGMENT_STEP_FINE : SEGMENT_STEP;
    const along: Record<string, ['x' | 'y', number]> = {
      ArrowLeft: ['x', -step],
      ArrowRight: ['x', step],
      ArrowUp: ['y', -step],
      ArrowDown: ['y', step],
    };
    const arrow = along[event.key];
    if (arrow !== undefined) {
      // An arrow across the run would bend it: ignored, but kept from the canvas.
      if (arrow[0] === run.axis) nudgeSegment(editor, segment, run, arrow[1]);
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      resetSegment(editor, segment, run);
    } else if (event.key === 'Escape') focusConnector(context.edgeId);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Press on an end (050 R3). The drag starts after the threshold, from where the press was, so
   * the end keeps its offset to the pointer and never jumps (FR-007).
   */
  function beginEnd(event: PointerEvent<HTMLElement>, end: 'source' | 'target') {
    if (event.button !== 0 || ends === undefined) return;
    event.stopPropagation();
    drag.current?.cancel();
    const pressed = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const source = end === 'source';
    const ctx = {
      edgeId: context.edgeId,
      end,
      // The drawn ids: a group end is drawn on its `group:` frame (050 R6).
      ownId: endpointIdOf(source ? ends.source : ends.target),
      otherId: endpointIdOf(source ? ends.target : ends.source),
      start: source ? context.start : context.end,
      side: source ? ends.fromSide : ends.toSide,
      at: source ? ends.fromAt : ends.toAt,
    };
    drag.current = startPointerDrag(event, {
      onStart: () => {
        // The drawn targets, once per drag: cards and frames don't move while an end is dragged.
        endSession.current = startEndpointDrag(
          editor,
          { ...ctx, scene: targetScene(getNodes()) },
          pressed,
        );
        setActive({ key: `end-${end}`, index: -1 });
      },
      onMove: (e) => {
        if (endSession.current === null) return;
        moveEndpoint(endSession.current, screenToFlowPosition({ x: e.clientX, y: e.clientY }), {
          mod: e.metaKey || e.ctrlKey,
          zoom: getZoom(),
        });
      },
      onEnd: () => {
        const s = endSession.current;
        finish();
        if (s !== null) endEndpointDrag(editor, s);
      },
      onCancel: () => {
        const s = endSession.current;
        finish();
        if (s === null || s.cancelled) return;
        cancelEndpointDrag(s);
        useUiStore.getState().announce('Cancelled');
      },
    });
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

  /**
   * ← / ↑ and → / ↓ move an end one stop along its side, onto the next side at a corner; with
   * Shift, 1 % of the side (FR-014). One undo step per press.
   */
  function endKeys(event: KeyboardEvent<HTMLElement>, end: 'source' | 'target') {
    if (anchors === undefined) return;
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    if (event.key === 'Escape') focusConnector(context.edgeId);
    else if (!back && !forward) return;
    else {
      const [side, at] =
        end === 'source' ? [anchors.fromSide, anchors.fromAt] : [anchors.toSide, anchors.toAt];
      const next = event.shiftKey
        ? nudgeAnchor(side, at, forward ? 0.01 : -0.01)
        : stepAnchor(side, at, forward ? 1 : -1);
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

  const segmentSpot = segmentDrag ? segmentReadoutAt(vertices, active.index) : null;

  return (
    <ViewportPortal>
      {(anchors === undefined ? [] : (['source', 'target'] as const)).map((end) => (
        <button
          key={end}
          type="button"
          aria-label={end === 'source' ? 'Source end' : 'Target end'}
          data-kind="end"
          data-testid={`route-end-${end}`}
          {...(active?.key === `end-${end}` ? { 'data-active': '' } : {})}
          {...inertUnless(`end-${end}`)}
          className="sd-route-handle nodrag nopan absolute"
          // Above the cards and pointer-active (`.sd-route-handle` in index.css, 050 R1).
          style={placed(end === 'source' ? context.start : context.end)}
          onPointerDown={(event) => {
            beginEnd(event, end);
          }}
          onKeyDown={(event) => {
            endKeys(event, end);
          }}
        />
      ))}
      {points.slice(0, -1).map((from, i) => {
        const to = points[i + 1];
        if (to === undefined) return null;
        if (Math.hypot(to.x - from.x, to.y - from.y) * zoom < MIN_HANDLE_RUN) return null;
        const at = mid(from, to);
        return (
          <button
            key={`mid-${String(i)}`}
            type="button"
            aria-label={`Add bend between points ${String(i + 1)} and ${String(i + 2)}`}
            data-kind="midpoint"
            data-testid="route-midpoint"
            {...inertUnless(`mid-${String(i)}`)}
            className="sd-route-handle nodrag nopan absolute"
            style={placed(at)}
            onPointerDown={(event) => {
              begin(event, `mid-${String(i)}`, { kind: 'add', index: i, at });
            }}
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
      {runs.map((run) => {
        const key = `seg-${String(run.index)}`;
        return (
          <button
            key={key}
            type="button"
            aria-label={`Move segment ${String(run.index + 1)}`}
            data-kind="segment"
            data-axis={run.axis}
            data-testid="route-segment"
            {...(active?.key === key ? { 'data-active': '' } : {})}
            {...inertUnless(key)}
            className="sd-route-handle nodrag nopan absolute"
            style={placed(runMidpoint(run))}
            onPointerDown={(event) => {
              beginSegment(event, run);
            }}
            onDoubleClick={() => {
              if (segment !== undefined) resetSegment(editor, segment, run);
            }}
            onKeyDown={(event) => {
              segmentKeys(event, run);
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
          {...inertUnless(`bend-${String(i)}`)}
          className="sd-route-handle nodrag nopan absolute"
          style={placed(bend)}
          onPointerDown={(event) => {
            begin(event, `bend-${String(i)}`, { kind: 'move', index: i });
          }}
          onDoubleClick={() => {
            removeBend(editor, live, i);
          }}
          onKeyDown={(event) => {
            bendKeys(event, i);
          }}
        />
      ))}
      {readout !== null && endPreview !== null && (
        <span
          className="sd-route-readout"
          data-testid="route-readout"
          aria-hidden
          style={{ left: endPreview.point.x + 14, top: endPreview.point.y + 14 }}
        >
          {readout}
        </span>
      )}
      {readout !== null && preview !== null && segmentSpot !== null && (
        <span
          className="sd-route-readout"
          data-testid="route-readout"
          aria-hidden
          style={{ left: segmentSpot.x + 14, top: segmentSpot.y + 14 }}
        >
          {readout}
        </span>
      )}
      {readout !== null && preview !== null && active !== null && !segmentDrag && (
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
    </ViewportPortal>
  );
}
