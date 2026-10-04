/**
 * Dragging a whole straight run of an elbow connector (050 US5, research R7). The run moves only
 * along its normal, so right angles stay. Built on the 022 route model, with no new stored data:
 *
 * - An **inner** run (between two bends) moves both of its vertices on the run's axis. The drawn
 *   vertices become explicit bends (an automatic elbow or a 017 `offset` is materialised, as on
 *   the first bend edit: `offset` is removed and the model pins the elbow), and both sides are
 *   pinned so the stored bends draw the same line.
 * - A **start** or **end** run leaves its card perpendicular to the side. Moving it never moves the
 *   end on the card: the end keeps a short stub along the side's normal and the line jogs from
 *   there to the moved run (two new bends). A lone straight run jogs at both ends. Like an inner
 *   run, the vertices become stored bends and both sides are pinned.
 *
 * Snapping: the neighbouring parallel runs' lines, then the 22 px grid, within 6 screen px; ⌘ off.
 * While the pointer is down the live line lives in the UI store (`bendPreview`); release writes
 * once, simplified (one undo step). Esc writes nothing.
 */
import type { DeckEditor, EdgeRoutePatch } from '@sododeck/model';
import type { Side } from '@sododeck/schema';

import { useUiStore, type BendPreview } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';
import {
  elbowVertices,
  GRID_STEP,
  simplifyWaypoints,
  snapBend,
} from '../routing/connector-geometry';
import type { Run } from '../routing/elbow-runs';
import { NORMAL, type Box, type Point } from '../routing/route-path';
import { waypointsOf, type BendContext } from './bend-drag';
import { setActiveGesture } from './drag-session';

/** DESIGN.md "Snap guide": within 6 screen px, same as bends and cards. */
const SNAP_SCREEN_PX = 6;
/** A vertex this close to the line between its neighbours is dropped on release. */
const SIMPLIFY_TOLERANCE = 3;
/** How far an end leaves its card before the jog of a moved end run: the elbow's own lead. */
const STUB = 20;
/** Two bends closer than this are the same bend. */
const SAME_POINT = 0.5;
/** Arrow keys move a focused segment by a grid step, or 1 px with Shift. */
export const SEGMENT_STEP = GRID_STEP;
export const SEGMENT_STEP_FINE = 1;

/** The two ends of the connector as drawn: card (or group frame) boxes, resolved sides, `at`. */
export interface EndContext {
  fromBox: Box;
  toBox: Box;
  fromSide: Side;
  toSide: Side;
  /** Position along each side (0 to 1); 0.5 when the route has none. */
  fromAt: number;
  toAt: number;
}

/** What a segment edit needs about one connector: `start` / `end` must be the anchor points. */
export type SegmentContext = BendContext & EndContext;

/** What the run moves: two bends, one end, both ends (a lone straight run), or nothing. */
type Mode = 'inner' | 'start' | 'end' | 'both' | 'none';

export interface SegmentSession {
  ctx: SegmentContext;
  /** The run as found in the drawn vertices when the drag started. */
  run: Run;
  mode: Mode;
  /** The drawn vertices (line start, corners, line end) before the gesture. */
  initial: readonly Point[];
  /** The live vertices. */
  live: Point[];
  /** Run position minus pointer position on the run axis at press, so the run never jumps. */
  grab: number;
  cancelled: boolean;
}

type Axis = 'x' | 'y';

const withAxis = (p: Point, axis: Axis, value: number): Point =>
  axis === 'x' ? { x: value, y: p.y } : { x: p.x, y: value };
/** The axis a side runs along: top and bottom run along x. */
const alongAxis = (side: Side): Axis => (side === 'top' || side === 'bottom' ? 'x' : 'y');
const samePoints = (a: readonly Point[], b: readonly Point[]): boolean =>
  a.length === b.length &&
  a.every((p, i) => {
    const other = b[i];
    return other !== undefined && p.x === other.x && p.y === other.y;
  });

/**
 * The vertices of the elbow through the context's ends and bends, as the canvas draws an anchored
 * or bent elbow. Segment handles must use these (`elbowRuns(segmentVertices(ctx), …)`), so a
 * handle's run index means the same run here.
 */
export function segmentVertices(ctx: SegmentContext): Point[] {
  const end = NORMAL[ctx.toSide];
  return elbowVertices([ctx.start, ...ctx.bends, ctx.end], {
    start: NORMAL[ctx.fromSide],
    end: { x: -end.x, y: -end.y },
  });
}

/**
 * The end of the stub an end keeps when its run moves: along the side's normal, at most half way
 * to the run's other vertex so a short run still jogs inside itself.
 */
function stubPoint(end: Point, toward: Point, side: Side): Point {
  const normal = NORMAL[side];
  const length = Math.min(STUB, Math.hypot(toward.x - end.x, toward.y - end.y) / 2);
  return { x: end.x + normal.x * length, y: end.y + normal.y * length };
}

function makeSession(ctx: SegmentContext, run: Run, pointer?: Point): SegmentSession {
  const initial = segmentVertices(ctx);
  const i = run.index;
  const a = initial[i];
  const b = initial[i + 1];
  const last = initial.length - 2;
  let axis: Axis = run.axis;
  let mode: Mode = 'none';
  if (a !== undefined && b !== undefined) {
    const horizontal = a.y === b.y && a.x !== b.x;
    const vertical = a.x === b.x && a.y !== b.y;
    if (horizontal || vertical) {
      axis = horizontal ? 'y' : 'x';
      mode = i === 0 && i === last ? 'both' : i === 0 ? 'start' : i === last ? 'end' : 'inner';
    }
  }
  // An end run that does not leave its card along the side's normal can't jog off its stub.
  if ((mode === 'start' || mode === 'both') && alongAxis(ctx.fromSide) !== axis) mode = 'none';
  if ((mode === 'end' || mode === 'both') && alongAxis(ctx.toSide) !== axis) mode = 'none';
  const from = a ?? run.from;
  const to = b ?? run.to;
  return {
    ctx,
    run: {
      index: i,
      axis,
      from,
      to,
      kind: mode === 'inner' ? 'inner' : mode === 'end' ? 'end' : 'start',
    },
    mode,
    initial,
    live: initial.map((p) => ({ ...p })),
    grab: pointer === undefined ? 0 : from[axis] - pointer[axis],
    cancelled: false,
  };
}

/** The parallel runs' lines a run can line up with: the vertices just beyond its neighbours. */
function neighbourPoints(s: SegmentSession): Point[] {
  const i = s.run.index;
  const n = s.initial.length;
  const picks =
    s.mode === 'inner'
      ? [s.initial[i - 1], s.initial[i + 2]]
      : s.mode === 'start'
        ? [s.initial[0], s.initial[2]]
        : s.mode === 'end'
          ? [s.initial[n - 1], s.initial[n - 3]]
          : [s.initial[0], s.initial[n - 1]];
  return picks.filter((p): p is Point => p !== undefined);
}

interface Applied {
  value: number;
  guide: { axis: Axis; at: number; from: number; to: number } | null;
}

/** Moves the run to `value` on its axis (snapped unless `snap` is null) and updates `live`. */
function apply(s: SegmentSession, wanted: number, snap: { zoom: number } | null): Applied | null {
  const { axis, index: i } = s.run;
  const neighbours = neighbourPoints(s);
  let value = wanted;
  let snappedTo: number | null = null;
  if (snap !== null) {
    const zoom = snap.zoom > 0 ? snap.zoom : 1;
    const result = snapBend({ x: wanted, y: wanted }, neighbours, GRID_STEP, SNAP_SCREEN_PX / zoom);
    value = result.point[axis];
    snappedTo = result.guides.find((g) => g.axis === axis)?.at ?? null;
  }
  const { ctx, live } = s;
  const n = live.length;
  const setVertex = (index: number, point: Point) => {
    if (index >= 0 && index < n) live[index] = point;
  };
  const vertex = (index: number): Point | undefined => live[index];
  switch (s.mode) {
    case 'none':
      return null;
    case 'inner': {
      const a = vertex(i);
      const b = vertex(i + 1);
      if (a === undefined || b === undefined) return null;
      setVertex(i, withAxis(a, axis, value));
      setVertex(i + 1, withAxis(b, axis, value));
      break;
    }
    case 'start':
    case 'end':
    case 'both': {
      // The ends stay where they are; each moved end gets a stub and a jog to the run's new line.
      const first = s.initial[0];
      const last = s.initial[s.initial.length - 1];
      if (first === undefined || last === undefined) return null;
      const inner = s.initial.slice(1, -1).map((p) => ({ ...p }));
      const head: Point[] = [first];
      const tail: Point[] = [last];
      if (s.mode !== 'end') {
        const stub = stubPoint(first, s.initial[1] ?? last, ctx.fromSide);
        head.push(stub, withAxis(stub, axis, value));
      } else {
        const prev = inner[inner.length - 1];
        if (prev !== undefined) inner[inner.length - 1] = withAxis(prev, axis, value);
      }
      if (s.mode !== 'start') {
        const stub = stubPoint(last, s.initial[s.initial.length - 2] ?? first, ctx.toSide);
        tail.unshift(withAxis(stub, axis, value), stub);
      } else {
        const next = inner[0];
        if (next !== undefined) inner[0] = withAxis(next, axis, value);
      }
      s.live = [...head, ...inner, ...tail];
      break;
    }
  }
  if (snappedTo === null || snappedTo !== value) return { value, guide: null };
  const other: Axis = axis === 'x' ? 'y' : 'x';
  const span = [...s.live.filter((p) => p[axis] === value), ...neighbours].map((p) => p[other]);
  return {
    value,
    guide: { axis, at: value, from: Math.min(...span), to: Math.max(...span) },
  };
}

function preview(s: SegmentSession): BendPreview {
  return { edgeId: s.ctx.edgeId, bends: s.live.slice(1, -1) };
}

function readout(s: SegmentSession, value: number): string {
  return `${s.run.axis} ${String(Math.round(value))}`;
}

/** The route change of the session, or null when nothing changed. */
function patchOf(s: SegmentSession): EdgeRoutePatch | null {
  const { ctx } = s;
  const simplified = simplifyWaypoints(s.live, SIMPLIFY_TOLERANCE);
  // A run dragged back where it was leaves only an empty jog, which simplifies away.
  if (samePoints(simplified, simplifyWaypoints(s.initial, SIMPLIFY_TOLERANCE))) return null;
  const kept = simplified.slice(1, -1);
  return {
    waypoints: kept.length === 0 ? null : waypointsOf(ctx, kept),
    offset: null,
    fromSide: ctx.fromSide,
    toSide: ctx.toSide,
  };
}

function write(editor: DeckEditor, ctx: SegmentContext, patch: EdgeRoutePatch): void {
  oneStep(editor, () => {
    editor.setEdgeRoute(ctx.edgeId, patch);
  });
}

function clearGesture(): void {
  setActiveGesture(null);
  const ui = useUiStore.getState();
  if (ui.canvasGesture === 'segment') ui.setCanvasGesture(null);
  ui.setBendPreview(null);
  ui.setConnectorReadout(null);
  ui.setGuides([]);
}

/**
 * Starts a drag of `run` (from `elbowRuns(segmentVertices(ctx), …)`). `pointer` is where the press
 * happened (canvas px): the run then keeps its distance to the pointer instead of jumping to it.
 * A run that can't move (an end run that doesn't leave along its side's normal) gives a session
 * that is already cancelled, so moves and release do nothing.
 */
export function startSegmentDrag(
  editor: DeckEditor,
  ctx: SegmentContext,
  run: Run,
  pointer?: Point,
): SegmentSession {
  const session = makeSession(ctx, run, pointer);
  if (session.mode === 'none') {
    session.cancelled = true;
    return session;
  }
  const ui = useUiStore.getState();
  ui.setCanvasGesture('segment');
  ui.setBendPreview(preview(session));
  ui.setConnectorReadout(readout(session, session.run.from[session.run.axis]));
  setActiveGesture({
    cancel: () => {
      if (session.cancelled) return false;
      cancelSegmentDrag(session);
      useUiStore.getState().announce('Cancelled');
      return true;
    },
    arrow: () => false,
    reset: () => {
      if (session.cancelled) return false;
      cancelSegmentDrag(session);
      resetSegment(editor, ctx, run);
      return true;
    },
  });
  return session;
}

/** One frame: the run follows the pointer on its axis, snapped unless `mod` (⌘ / Ctrl). */
export function moveSegment(
  session: SegmentSession,
  pointer: Point,
  options: { mod: boolean; zoom: number },
): void {
  if (session.cancelled) return;
  const applied = apply(
    session,
    pointer[session.run.axis] + session.grab,
    options.mod ? null : { zoom: options.zoom },
  );
  if (applied === null) return;
  const ui = useUiStore.getState();
  ui.setBendPreview(preview(session));
  ui.setConnectorReadout(readout(session, applied.value));
  ui.setGuides(applied.guide === null ? [] : [applied.guide]);
}

/** Release: writes the route once (simplified), or nothing when nothing changed. */
export function endSegmentDrag(editor: DeckEditor, session: SegmentSession): void {
  // Every exit clears the gesture's UI state, even after a cancel or reset (050 R9).
  clearGesture();
  if (session.cancelled) return;
  session.cancelled = true;
  const patch = patchOf(session);
  if (patch === null) return;
  write(editor, session.ctx, patch);
  useUiStore.getState().announce('Segment moved');
}

/** Esc, blur, `pointercancel` or unmount: nothing was written, so dropping the preview is all. */
export function cancelSegmentDrag(session: SegmentSession): void {
  session.cancelled = true;
  clearGesture();
}

/**
 * Double-click or ⌫ on a segment handle: an inner run loses its stored bends (the run goes back
 * to its automatic place); an end run's `at` is cleared. Nothing happens on an automatic run.
 */
export function resetSegment(editor: DeckEditor, ctx: SegmentContext, run: Run): void {
  const s = makeSession(ctx, run);
  const patch: EdgeRoutePatch = {};
  if (s.mode === 'inner') {
    const corners = [s.initial[s.run.index], s.initial[s.run.index + 1]].filter(
      (p): p is Point => p !== undefined,
    );
    const kept = ctx.bends.filter(
      (b) => !corners.some((c) => Math.hypot(b.x - c.x, b.y - c.y) < SAME_POINT),
    );
    if (kept.length === ctx.bends.length) return;
    patch.waypoints = kept.length === 0 ? null : waypointsOf(ctx, kept);
    patch.offset = null;
  } else {
    if ((s.mode === 'start' || s.mode === 'both') && ctx.fromAt !== 0.5) patch.fromAt = null;
    if ((s.mode === 'end' || s.mode === 'both') && ctx.toAt !== 0.5) patch.toAt = null;
    if (Object.keys(patch).length === 0) return;
  }
  write(editor, ctx, patch);
  useUiStore.getState().announce('Segment reset');
}

/** An arrow key on a focused segment handle: moves the run by `delta` on its axis, no snapping. */
export function nudgeSegment(
  editor: DeckEditor,
  ctx: SegmentContext,
  run: Run,
  delta: number,
): void {
  const s = makeSession(ctx, run);
  if (apply(s, s.run.from[s.run.axis] + delta, null) === null) return;
  const patch = patchOf(s);
  if (patch === null) return;
  write(editor, ctx, patch);
  useUiStore.getState().announce('Segment moved');
}
