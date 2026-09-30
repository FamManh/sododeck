/**
 * Moving a connector's middle segment (017 R7, FR-014): the pointer's position along the
 * segment's own axis becomes an `offset` from where automatic routing puts it — free, with no
 * clamp, so the segment may pass over cards — then snapped to the other on-screen cards' centre
 * or edge lines unless ⌘ is held. One undo step for the whole drag; Esc cancels it; R resets it
 * mid-drag (`resetDuringDrag`, wired by `use-canvas-shortcuts.ts`'s R handler, T037).
 */
import type { DeckEditor } from '@sododeck/model';
import type { Id, Side } from '@sododeck/schema';

import { useUiStore, type Guide } from '../../state/ui-store';
import { cardBox, type Rect } from '../canvas-geometry';
import { edgeName } from '../deck-to-flow';
import type { Level } from '../levels';
import {
  middleSegment,
  resolveSides,
  routedStepPath,
  type MiddleAxis,
} from '../routing/route-path';
import { scopeOf, visibleGraph } from '../visible-graph';
import { readViewState } from '../views/use-current-view';
import { setActiveGesture } from './drag-session';
import { snapCandidates, snapSegment, type SnapCandidates } from './snap';

/** DESIGN.md "Snap guide": within 6 screen px, same as card drag and resize. */
const SNAP_SCREEN_PX = 6;

export interface SegmentDragSession {
  edgeId: Id;
  name: string;
  axis: MiddleAxis;
  /** The automatic route's position on the moving axis, ignoring any stored offset. */
  automaticAt: number;
  /** The segment's extent on its fixed axis, for the snap guide's span. */
  span: { from: number; to: number };
  candidates: SnapCandidates;
  /** The offset last written, for the closing announcement and `resetDuringDrag`. */
  last: number;
  cancelled: boolean;
}

/** The point a connection leaves or enters a box from a given side (matches `deck-node.tsx`). */
function anchorOf(box: Rect, side: Side): { x: number; y: number } {
  switch (side) {
    case 'top':
      return { x: box.x + box.width / 2, y: box.y };
    case 'bottom':
      return { x: box.x + box.width / 2, y: box.y + box.height };
    case 'left':
      return { x: box.x, y: box.y + box.height / 2 };
    case 'right':
      return { x: box.x + box.width, y: box.y + box.height / 2 };
  }
}

function signed(n: number): string {
  const rounded = Math.round(n);
  return rounded >= 0 ? `+${String(rounded)}` : String(rounded);
}

/** `dragReadout` is `{dx, dy}` (016); a segment only moves on one axis, so the other stays 0. */
function readoutOf(axis: MiddleAxis, offset: number): { dx: number; dy: number } {
  return axis === 'vertical' ? { dx: 0, dy: offset } : { dx: offset, dy: 0 };
}

/**
 * Starts a segment drag. Null when the edge is missing, an endpoint is not drawn in the current
 * view, or the resolved sides do not face each other (no movable middle segment to drag).
 */
export function startSegmentDrag(
  editor: DeckEditor,
  edgeId: Id,
  level: Level,
): SegmentDragSession | null {
  const view = readViewState(editor.doc);
  const edge = view.deck.edges.find((e) => e.id === edgeId);
  if (edge === undefined) return null;
  const fromIndex = view.deck.nodes.findIndex((n) => n.id === edge.from);
  const toIndex = view.deck.nodes.findIndex((n) => n.id === edge.to);
  const fromNode = view.deck.nodes[fromIndex];
  const toNode = view.deck.nodes[toIndex];
  if (fromNode === undefined || toNode === undefined) return null;
  const fromBox = cardBox(fromNode, fromIndex, level);
  const toBox = cardBox(toNode, toIndex, level);
  const sides = resolveSides(fromBox, toBox, edge.route);
  const axis = middleSegment(sides);
  if (axis === null) return null;
  const source = anchorOf(fromBox, sides[0]);
  const target = anchorOf(toBox, sides[1]);
  const automatic = routedStepPath({
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
    sides,
  });
  if (automatic.segment === null) return null;

  const ui = useUiStore.getState();
  const scope = scopeOf(ui.drill);
  const graph = visibleGraph(view.deck, scope, view.collapsed);
  const visible = new Set(graph.nodes);
  const others: Rect[] = [];
  view.deck.nodes.forEach((node, i) => {
    if (!visible.has(node.id) || node.id === edge.from || node.id === edge.to) return;
    others.push(cardBox(node, i, level));
  });

  const session: SegmentDragSession = {
    edgeId,
    name: edgeName(fromNode.title, toNode.title, edge.label),
    axis,
    automaticAt: automatic.segment.at,
    span: { from: automatic.segment.from, to: automatic.segment.to },
    candidates: snapCandidates(others),
    last: edge.route?.offset ?? 0,
    cancelled: false,
  };
  editor.beginGesture();
  ui.setCanvasGesture('segment');
  ui.setDragReadout(readoutOf(axis, session.last));
  setActiveGesture({
    cancel: () => {
      if (session.cancelled) return false;
      session.cancelled = true;
      editor.cancelGesture();
      ui.setCanvasGesture(null);
      ui.setDragReadout(null);
      ui.setGuides([]);
      ui.announce('Cancelled');
      return true;
    },
    arrow: () => false,
    reset: () => {
      if (session.cancelled) return false;
      resetDuringDrag(editor, session);
      return true;
    },
  });
  return session;
}

/** One frame of the drag: the pointer's position along the segment's own axis, then snapped. */
export function applySegmentDrag(
  editor: DeckEditor,
  session: SegmentDragSession,
  pointer: { x: number; y: number },
  mods: { mod: boolean },
  zoom: number,
): void {
  if (session.cancelled) return;
  let at = session.axis === 'vertical' ? pointer.y : pointer.x;
  let guides: readonly Guide[] = [];
  if (!mods.mod) {
    const threshold = SNAP_SCREEN_PX / (zoom > 0 ? zoom : 1);
    const snapped = snapSegment(at, session.axis, session.span, session.candidates, threshold);
    at = snapped.at;
    guides = snapped.guides;
  }
  const offset = at - session.automaticAt;
  const ui = useUiStore.getState();
  ui.setGuides(guides);
  editor.setEdgeRoute(session.edgeId, { offset });
  session.last = offset;
  ui.setDragReadout(readoutOf(session.axis, offset));
}

export function endSegmentDrag(editor: DeckEditor, session: SegmentDragSession): void {
  setActiveGesture(null);
  const ui = useUiStore.getState();
  if (ui.canvasGesture === 'segment') ui.setCanvasGesture(null);
  ui.setDragReadout(null);
  ui.setGuides([]);
  if (session.cancelled) return;
  editor.endGesture();
  ui.announce(`Moved middle segment to ${signed(session.last)}`);
}

/**
 * R mid-drag (FR-014's "reset"): cancels the open gesture, then removes the route's `offset`
 * (dropping `route` entirely once empty) as its own, single undo step — so the connector goes
 * back to automatic routing without leaving the drag's in-progress writes in history.
 */
export function resetDuringDrag(editor: DeckEditor, session: SegmentDragSession): void {
  if (session.cancelled) return;
  session.cancelled = true;
  editor.cancelGesture();
  editor.setEdgeRoute(session.edgeId, { offset: null });
  setActiveGesture(null);
  const ui = useUiStore.getState();
  if (ui.canvasGesture === 'segment') ui.setCanvasGesture(null);
  ui.setDragReadout(null);
  ui.setGuides([]);
  ui.announce('Reset middle segment');
}
