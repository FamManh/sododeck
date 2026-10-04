/**
 * Where a relationship (040 edge with column ends) meets its two tables (042 R2, R3, R5). Pure:
 * the canvas edge, the drag hit test and the export call these with 041's `TableLayout`, so they
 * draw the same anchors. Positions are offsets from each card's top-left; the live boxes add them.
 */
import type { Cardinality, Id, SododeckFile } from '@sododeck/schema';

import type { Box } from '../routing/route-path';
import { rowAnchorY, type TableLayout } from '../table-layout';

type Edge = SododeckFile['edges'][number];

export type RelSide = 'left' | 'right';

/** The four crow's foot ends (DESIGN.md "Crow's foot and ports"). */
export type CrowEnd = 'one' | 'zero-one' | 'one-many' | 'zero-many';

/** One end of a relationship, relative to its card. */
export interface RelationshipEnd {
  /**
   * Vertical anchor(s) from the card's top: one per visible composite member (≥ 2), else one.
   * Empty for an end that names no column: it meets the card at its vertical middle.
   */
  offsets: readonly number[];
  kind: 'row' | 'pill' | 'title' | 'outline';
  /** The cardinality mark; absent without a cardinality. */
  mark?: CrowEnd;
}

export interface RelationshipEnds {
  from: RelationshipEnd;
  to: RelationshipEnd;
}

/**
 * A relationship: a connector between two tables with column ends on either side, or with a
 * cardinality. Card-to-card connectors keep their knob, arrow and outline anchors.
 */
export function isRelationship(
  edge: Pick<Edge, 'from' | 'to' | 'fromColumns' | 'toColumns' | 'cardinality'>,
  isTable: (id: Id) => boolean,
): boolean {
  if (!isTable(edge.from) || !isTable(edge.to)) return false;
  return (
    (edge.fromColumns?.length ?? 0) > 0 ||
    (edge.toColumns?.length ?? 0) > 0 ||
    edge.cardinality !== undefined
  );
}

/** Whether either end names a column: the relationship is drawn from rows, not the outline. */
export function hasColumnEnds(edge: Pick<Edge, 'fromColumns' | 'toColumns'>): boolean {
  return (edge.fromColumns?.length ?? 0) > 0 || (edge.toColumns?.length ?? 0) > 0;
}

/**
 * The sides a relationship's ends use (R3): facing sides when the boxes do not overlap
 * horizontally; otherwise the one side both ends share that gives the shorter connector (right on
 * a tie). A self-reference uses right / right. Top and bottom are never used for column ends.
 */
export function relationshipSides(
  fromBox: Box,
  toBox: Box,
  self = false,
): { from: RelSide; to: RelSide } {
  if (self) return { from: 'right', to: 'right' };
  const fromRight = fromBox.x + fromBox.width;
  const toRight = toBox.x + toBox.width;
  if (fromRight <= toBox.x) return { from: 'right', to: 'left' };
  if (toRight <= fromBox.x) return { from: 'left', to: 'right' };
  const side: RelSide =
    Math.abs(fromBox.x - toBox.x) < Math.abs(fromRight - toRight) ? 'left' : 'right';
  return { from: side, to: side };
}

/**
 * The mark at one end (R7): the `from` side reads the first letter of the cardinality, the `to`
 * side the second; `1` is one / zero-one and `n` one-many / zero-many by the optional flag.
 */
export function endOf(
  cardinality: Cardinality | undefined,
  side: 'from' | 'to',
  optional: boolean | undefined,
): CrowEnd | undefined {
  if (cardinality === undefined) return undefined;
  const many = (side === 'from' ? cardinality[0] : cardinality[2]) === 'n';
  if (optional === true) return many ? 'zero-many' : 'zero-one';
  return many ? 'one-many' : 'one';
}

function endAt(
  layout: TableLayout | undefined,
  columns: readonly Id[] | undefined,
  mark: CrowEnd | undefined,
): RelationshipEnd {
  const withMark = mark === undefined ? {} : { mark };
  if (layout === undefined || columns === undefined || columns.length === 0) {
    return { offsets: [], kind: 'outline', ...withMark };
  }
  const anchors = columns.map((column) => rowAnchorY(layout, column));
  const rows = anchors.filter((anchor) => anchor.kind === 'row');
  // A composite end draws only its visible members (R5); with one or none it is a single end.
  if (rows.length > 0) return { offsets: rows.map((row) => row.y), kind: 'row', ...withMark };
  const first = anchors[0] ?? { y: layout.titleCenter, kind: 'title' as const };
  return { offsets: [first.y], kind: first.kind, ...withMark };
}

/** Both ends' anchors and marks, from the two tables' layouts (data.rel on the canvas). */
export function relationshipEnds(
  edge: Pick<Edge, 'fromColumns' | 'toColumns' | 'cardinality' | 'fromOptional' | 'toOptional'>,
  fromLayout: TableLayout | undefined,
  toLayout: TableLayout | undefined,
): RelationshipEnds {
  return {
    from: endAt(fromLayout, edge.fromColumns, endOf(edge.cardinality, 'from', edge.fromOptional)),
    to: endAt(toLayout, edge.toColumns, endOf(edge.cardinality, 'to', edge.toOptional)),
  };
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** Structural compare, so an unchanged relationship keeps its cached React Flow edge. */
export function sameEnds(a: RelationshipEnds | undefined, b: RelationshipEnds): boolean {
  if (a === undefined) return false;
  return (['from', 'to'] as const).every(
    (key) =>
      a[key].kind === b[key].kind &&
      a[key].mark === b[key].mark &&
      sameNumbers(a[key].offsets, b[key].offsets),
  );
}
