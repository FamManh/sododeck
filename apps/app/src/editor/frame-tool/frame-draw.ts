/**
 * The Frame tool's plan (031 research R5, Frame = Group): what one drawn rectangle becomes. Pure.
 * The frame is a normal group (ADR 0017): its rectangle, at least `MIN_FRAME`; its parent is the
 * innermost visible frame that fully contains it, else the drilled-in group, else none; its
 * members are the items of that level whose boxes are fully inside (cards, shapes, frames; never
 * stickies, which are not group members). Membership is decided once, here: moving a frame later
 * never captures anything (016 FR-046).
 */
import type { Frame, Id, SododeckFile } from '@sododeck/schema';

import { cardBox, groupBounds, type Point, type Rect } from '../canvas-geometry';
import { MIN_FRAME } from '../editing/resize-limits';
import type { VisibleGraph } from '../visible-graph';

/** A click without a drag places this, centred on the point. */
export const DEFAULT_FRAME = { width: 320, height: 200 } as const;

/** Below this many screen px of movement a press is a click, not a drag. */
export const DRAG_THRESHOLD = 4;

export interface FramePlan {
  frame: Frame;
  parent: Id | undefined;
  nodes: Id[];
  groups: Id[];
}

/** At least the minimum frame size, growing from the rectangle's top-left corner. */
export function clampToMinimum(rect: Rect): Rect {
  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(rect.width, MIN_FRAME.width),
    height: Math.max(rect.height, MIN_FRAME.height),
  };
}

export function clickFrame(point: Point): Rect {
  return {
    x: point.x - DEFAULT_FRAME.width / 2,
    y: point.y - DEFAULT_FRAME.height / 2,
    ...DEFAULT_FRAME,
  };
}

/** The rectangle between two corners, any drag direction. */
export function rectBetween(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

const contains = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/**
 * What drawing `drawn` makes. `deck` is the view-projected deck the canvas draws (view positions,
 * hidden components left out) and `graph` what is visible in the current scope.
 */
export function framePlan(deck: SododeckFile, graph: VisibleGraph, drawn: Rect): FramePlan {
  const rect = clampToMinimum(drawn);
  const bounds = groupBounds(deck, 'component');
  const visibleGroups = new Set(graph.groups);

  // The innermost visible frame fully around the drawn one: the smallest that contains it.
  let parent: Id | undefined;
  let parentArea = Infinity;
  for (const id of visibleGroups) {
    const box = bounds.get(id);
    if (box === undefined || !contains(box, rect)) continue;
    const area = box.width * box.height;
    if (area < parentArea) {
      parent = id;
      parentArea = area;
    }
  }
  parent ??= graph.scope.group ?? undefined;

  const visibleNodes = new Set(graph.nodes);
  const nodes: Id[] = [];
  deck.nodes.forEach((node, index) => {
    if (!visibleNodes.has(node.id) || node.group !== parent) return;
    if (contains(rect, cardBox(node, index, 'component'))) nodes.push(node.id);
  });
  const groups = deck.groups
    .filter((group) => visibleGroups.has(group.id) && group.parent === parent)
    .filter((group) => {
      const box = bounds.get(group.id);
      return box !== undefined && contains(rect, box);
    })
    .map((group) => group.id);

  return {
    frame: {
      position: { x: rect.x, y: rect.y },
      size: { width: rect.width, height: rect.height },
    },
    parent,
    nodes,
    groups,
  };
}
