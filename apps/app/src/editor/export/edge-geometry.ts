import { Position, getSmoothStepPath } from '@xyflow/react';

import type { Point, Rect } from '../canvas-geometry';
import { facingSides, type HandleSide } from '../deck-to-flow';

/** How far a smooth-step path can swing past its handle points. */
const STEP_OFFSET = 20;

const POSITION: Record<HandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

/** The midpoint of one side of a card: where the canvas puts that side's handle. */
export function handlePoint(rect: Rect, side: HandleSide): Point {
  switch (side) {
    case 'top':
      return { x: rect.x + rect.width / 2, y: rect.y };
    case 'right':
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    case 'bottom':
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case 'left':
      return { x: rect.x, y: rect.y + rect.height / 2 };
  }
}

export interface EdgeGeometry {
  path: string;
  source: Point;
  target: Point;
  labelX: number;
  labelY: number;
  extent: Rect;
}

/**
 * The canvas's edge between two cards: facing sides from their top-left corners (as
 * `DeckEdge` / `MergedEdge`) and React Flow's smooth-step path with an 8 px corner radius.
 */
export function edgePath(from: Rect, to: Rect): EdgeGeometry {
  // TODO(017): honour edge.route once custom routes exist.
  const [sourceSide, targetSide] = facingSides(from, to);
  const source = handlePoint(from, sourceSide);
  const target = handlePoint(to, targetSide);
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: source.x,
    sourceY: source.y,
    sourcePosition: POSITION[sourceSide],
    targetX: target.x,
    targetY: target.y,
    targetPosition: POSITION[targetSide],
    borderRadius: 8,
  });
  const x = Math.min(source.x, target.x) - STEP_OFFSET;
  const y = Math.min(source.y, target.y) - STEP_OFFSET;
  return {
    path,
    source,
    target,
    labelX,
    labelY,
    extent: {
      x,
      y,
      width: Math.max(source.x, target.x) + STEP_OFFSET - x,
      height: Math.max(source.y, target.y) + STEP_OFFSET - y,
    },
  };
}
