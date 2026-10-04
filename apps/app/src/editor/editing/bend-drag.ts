/**
 * Adding, moving and removing a connector's bend points (022 R1, R9). A bend is stored relative
 * to the two card centres (`encodeWaypoint`), but while the pointer is down the live positions
 * live in the UI store, so a drag frame writes nothing to the document; releasing writes the
 * whole list with one `setEdgeRoute` (one undo step). Snapping prefers a neighbouring point's
 * line (right angles) before the 22 px grid; ⌘ turns both off. Dropping a bend onto the line
 * between its neighbours removes it (auto-simplify).
 */
import type { DeckEditor } from '@sododeck/model';
import type { Id, RouteWaypoint } from '@sododeck/schema';

import { useUiStore } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';
import {
  encodeWaypoint,
  GRID_STEP,
  simplifyWaypoints,
  snapBend,
} from '../routing/connector-geometry';
import type { Point } from '../routing/route-path';
import { setActiveGesture } from './drag-session';

/** DESIGN.md "Snap guide": within 6 screen px, same as card drag and resize. */
const SNAP_SCREEN_PX = 6;
/** A bend this close to the line between its neighbours is dropped on release. */
const SIMPLIFY_TOLERANCE = 3;
/** Arrow keys move a focused bend by a grid step, or 1 px with Shift. */
export const BEND_STEP = GRID_STEP;
export const BEND_STEP_FINE = 1;

/** Everything a bend edit needs about one connector in the view being drawn. */
export interface BendContext {
  edgeId: Id;
  fromCentre: Point;
  toCentre: Point;
  /** Where the line starts and ends on the cards (anchors). */
  start: Point;
  end: Point;
  /** The bends as drawn now (decoded waypoints, or the corners of a 017 offset). */
  bends: readonly Point[];
}

export type BendTarget =
  { kind: 'move'; index: number } | { kind: 'add'; index: number; at: Point };

export interface BendSession extends BendContext {
  /** The bend being dragged. */
  index: number;
  /** The bends before the gesture, for "nothing changed" and the ghost. */
  initial: readonly Point[];
  /** The live bends. */
  live: Point[];
  added: boolean;
  cancelled: boolean;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;
const r4 = (n: number): number => Math.round(n * 10000) / 10000;

/** Keeps stored numbers short: fractions to 4 places, pixel offsets to 0.1 px. */
function tidyWaypoint(w: RouteWaypoint): RouteWaypoint {
  return {
    ...(w.x === undefined ? { dx: r1(w.dx ?? 0) } : { x: r4(w.x) }),
    ...(w.y === undefined ? { dy: r1(w.dy ?? 0) } : { y: r4(w.y) }),
  };
}

const sameBends = (a: readonly Point[], b: readonly Point[]): boolean =>
  a.length === b.length &&
  a.every((p, i) => {
    const other = b.at(i);
    return other !== undefined && p.x === other.x && p.y === other.y;
  });

function readout(point: Point): string {
  return `x ${String(Math.round(point.x))} · y ${String(Math.round(point.y))}`;
}

function neighbours(session: BendContext & { live: readonly Point[]; index: number }): Point[] {
  const before = session.index === 0 ? session.start : session.live[session.index - 1];
  const after =
    session.index === session.live.length - 1 ? session.end : session.live[session.index + 1];
  return [before, after].filter((p): p is Point => p !== undefined);
}

function waypointsOf(ctx: BendContext, bends: readonly Point[]): RouteWaypoint[] {
  return bends.map((p) => tidyWaypoint(encodeWaypoint(p, ctx.fromCentre, ctx.toCentre)));
}

function write(editor: DeckEditor, ctx: BendContext, bends: readonly Point[]): void {
  const waypoints = waypointsOf(ctx, bends);
  oneStep(editor, () => {
    editor.setEdgeRoute(ctx.edgeId, { waypoints: waypoints.length === 0 ? null : waypoints });
  });
}

function clearGesture(): void {
  setActiveGesture(null);
  const ui = useUiStore.getState();
  if (ui.canvasGesture === 'bend') ui.setCanvasGesture(null);
  ui.setBendPreview(null);
  ui.setConnectorReadout(null);
  ui.setGuides([]);
}

/** Starts a drag of an existing bend, or of a new one inserted at `target.index`. */
export function startBendDrag(
  editor: DeckEditor,
  ctx: BendContext,
  target: BendTarget,
): BendSession {
  const live = ctx.bends.map((p) => ({ ...p }));
  if (target.kind === 'add') live.splice(target.index, 0, { ...target.at });
  const session: BendSession = {
    ...ctx,
    index: target.index,
    initial: ctx.bends.map((p) => ({ ...p })),
    live,
    added: target.kind === 'add',
    cancelled: false,
  };
  const ui = useUiStore.getState();
  ui.setCanvasGesture('bend');
  ui.setBendPreview({ edgeId: ctx.edgeId, bends: live });
  const at = live[target.index];
  if (at !== undefined) ui.setConnectorReadout(readout(at));
  setActiveGesture({
    cancel: () => {
      if (session.cancelled) return false;
      cancelBendDrag(session);
      useUiStore.getState().announce('Cancelled');
      return true;
    },
    arrow: () => false,
    reset: () => {
      if (session.cancelled) return false;
      session.cancelled = true;
      clearGesture();
      oneStep(editor, () => {
        editor.setEdgeRoute(ctx.edgeId, null);
      });
      useUiStore.getState().announce('Route reset');
      return true;
    },
  });
  return session;
}

/** One frame: the pointer (canvas px) becomes the bend's live position, snapped. */
export function moveBend(
  session: BendSession,
  pointer: Point,
  options: { mod: boolean; zoom: number },
): void {
  if (session.cancelled) return;
  const zoom = options.zoom > 0 ? options.zoom : 1;
  const snapped = options.mod
    ? { point: pointer, guides: [] }
    : snapBend(pointer, neighbours(session), GRID_STEP, SNAP_SCREEN_PX / zoom);
  session.live[session.index] = snapped.point;
  const ui = useUiStore.getState();
  ui.setBendPreview({ edgeId: session.edgeId, bends: [...session.live] });
  ui.setConnectorReadout(readout(snapped.point));
  ui.setGuides(
    snapped.guides.map((g) => ({
      axis: g.axis,
      at: g.at,
      from:
        g.axis === 'x'
          ? Math.min(snapped.point.y, session.start.y)
          : Math.min(snapped.point.x, session.start.x),
      to:
        g.axis === 'x'
          ? Math.max(snapped.point.y, session.end.y)
          : Math.max(snapped.point.x, session.end.x),
    })),
  );
}

/** Releases the pointer: writes the bends once (simplified), or nothing when nothing changed. */
export function endBendDrag(editor: DeckEditor, session: BendSession): void {
  // Every exit clears the gesture's UI state, even after a cancel or reset (050 R9).
  clearGesture();
  if (session.cancelled) return;
  const kept = simplifyWaypoints(
    [session.start, ...session.live, session.end],
    SIMPLIFY_TOLERANCE,
  ).slice(1, -1);
  const ui = useUiStore.getState();
  if (sameBends(kept, session.initial)) return;
  write(editor, session, kept);
  if (kept.length < session.initial.length) ui.announce('Bend removed');
  else if (session.added && kept.length > session.initial.length) ui.announce('Bend added');
  else ui.announce(kept.length === 0 ? 'Bend removed' : 'Bend moved');
}

/** Esc, blur, `pointercancel` or unmount: nothing was written, so dropping the preview is the
 * whole cancel. */
export function cancelBendDrag(session: BendSession): void {
  session.cancelled = true;
  clearGesture();
}

/** ⌫ / Delete / double-click on a bend: removes only that bend; the connector stays. */
export function removeBend(editor: DeckEditor, ctx: BendContext, index: number): void {
  const bends = ctx.bends.filter((_, i) => i !== index);
  if (bends.length === ctx.bends.length) return;
  write(editor, ctx, bends);
  useUiStore.getState().announce('Bend removed');
}

/** ⏎ on a midpoint: adds a bend at that point. */
export function addBendAt(editor: DeckEditor, ctx: BendContext, index: number, at: Point): void {
  const bends = ctx.bends.map((p) => ({ ...p }));
  bends.splice(index, 0, at);
  write(editor, ctx, bends);
  useUiStore.getState().announce('Bend added');
}

/** An arrow key on a focused bend: one step of 22 px (1 px with Shift), one undo step each. */
export function nudgeBend(editor: DeckEditor, ctx: BendContext, index: number, delta: Point): void {
  const at = ctx.bends[index];
  if (at === undefined) return;
  const bends = ctx.bends.map((p, i) => (i === index ? { x: p.x + delta.x, y: p.y + delta.y } : p));
  write(editor, ctx, bends);
  useUiStore.getState().announce('Bend moved');
}
