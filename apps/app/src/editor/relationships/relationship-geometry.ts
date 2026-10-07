/**
 * A relationship's drawn geometry from its two card boxes (042): the line, composite brackets,
 * end marks and label point. One pure function for the canvas edge and the export scene, so both
 * draw the same thing (SC-007).
 */
import type { Side } from '@sododeck/schema';

import { relationshipMark, type EndMark } from '../edge-end-marks';
import { connectorPath, type ConnectorRoute } from '../routing/connector-geometry';
import { relationshipPath, selfLoopPath, type RelEndInput } from '../routing/relationship-path';
import type { Box, PathShape, Point } from '../routing/route-path';
import {
  relationshipSides,
  type RelationshipEnd,
  type RelationshipEnds,
  type RelSide,
} from './relationship-ends';

export interface RelationshipGeometryInput {
  ends: RelationshipEnds;
  /** Rows are drawn: anchor on them; otherwise anchor on the outline like a connector. */
  rows: boolean;
  self: boolean;
  notation: 'crow' | 'numeric';
  hideEnds: boolean;
  fromBox: Box;
  toBox: Box;
  shape: PathShape;
  /** Outline mode: the connector's resolved sides (its handles on the canvas). */
  sides: readonly [Side, Side];
  route?: ConnectorRoute | undefined;
  /** Row mode: user bends between the stubs, absolute. */
  bends?: readonly Point[];
  /** Outline mode: the sideways shift of a fanned bundle member (034). */
  spread?: number;
}

export interface RelationshipGeometry {
  path: string;
  bracket: string;
  marks: EndMark[];
  label: Point;
  /** The row-mode sides (end handles sit there); absent in outline mode. */
  sides?: { from: RelSide; to: RelSide };
  /** Where each end meets its card, for end handles. */
  start: Point;
  end: Point;
  /** Row mode, curved or elbow, not a loop: the stub tips the path handles reshape between (064). */
  stubs?: { from: Point; to: Point };
}

function endInput(box: Box, side: RelSide, end: RelationshipEnd): RelEndInput {
  return {
    side,
    x: side === 'right' ? box.x + box.width : box.x,
    ys: end.offsets.length === 0 ? [box.y + box.height / 2] : end.offsets.map((y) => box.y + y),
  };
}

function marksOf(
  input: RelationshipGeometryInput,
  from: { at: Point; u: Point },
  to: { at: Point; u: Point },
): EndMark[] {
  if (input.hideEnds) return [];
  return [
    relationshipMark(from.at, from.u, input.ends.from.mark, input.notation),
    relationshipMark(to.at, to.u, input.ends.to.mark, input.notation),
  ].filter((mark) => mark !== undefined);
}

export function relationshipGeometry(input: RelationshipGeometryInput): RelationshipGeometry {
  const { ends, fromBox, toBox, shape } = input;
  if (input.rows) {
    const sides = relationshipSides(fromBox, toBox, input.self);
    const from = endInput(fromBox, sides.from, ends.from);
    const to = endInput(toBox, sides.to, ends.to);
    const path = input.self
      ? selfLoopPath(from, to, shape)
      : relationshipPath(from, to, shape, shape === 'straight' ? [] : (input.bends ?? []));
    return {
      path: path.d,
      bracket: path.bracket,
      marks: marksOf(input, path.from, path.to),
      label: path.label,
      sides,
      start: { x: from.x, y: path.from.at.y },
      end: { x: to.x, y: path.to.at.y },
      ...(path.stubs === undefined ? {} : { stubs: path.stubs }),
    };
  }
  // Below 90 % or without columns: an ordinary connector on the outline, marks kept (R6).
  const routed = connectorPath({
    shape,
    fromBox,
    toBox,
    sides: input.sides,
    route: input.route,
    spread: input.spread ?? 0,
    options: { arrowAtStart: false, arrowAtEnd: false },
  });
  const { start, end, startDir, endDir } = routed.ends;
  return {
    path: routed.path,
    bracket: '',
    marks: marksOf(
      input,
      { at: start, u: startDir },
      { at: end, u: { x: -endDir.x, y: -endDir.y } },
    ),
    label: { x: routed.labelX, y: routed.labelY },
    start,
    end,
  };
}
