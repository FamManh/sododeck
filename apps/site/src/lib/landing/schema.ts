/**
 * Pure layout of the Database pack visuals: table and enum card sizes, the y of each column row,
 * and relationships drawn from column row to column row with crow's feet (DB8).
 */
import type { EnumData, Relationship, Table } from './checkout-deck';
import { crowFoot, curve, normal, TABLE, type CrowFoot, type Point, type Side } from './geometry';

export interface TableGeometry {
  w: number;
  h: number;
  /** Top of the first column row. */
  top: number;
  /** Width of the key glyph column: wider when a column is both a primary and a foreign key. */
  keyWidth: number;
  /** Centre y of a column's row, from the card top. */
  rowY: (column: string) => number;
}

/** Size of a table card showing every column (tables here stay under the 12-column limit). */
export function tableGeometry(table: Table): TableGeometry {
  const top = TABLE.border + TABLE.pad + TABLE.header + TABLE.gap + TABLE.title + TABLE.gap;
  const rows = table.columns.length * TABLE.colHeight;
  const foot = table.indexes === undefined ? 0 : TABLE.foot;
  const doubleKey = table.columns.some((c) => c.pk === true && c.fk !== undefined);
  return {
    w: TABLE.width,
    h: top + rows + foot + TABLE.bottom + TABLE.border,
    top,
    keyWidth: doubleKey ? 30 : TABLE.keyWidth,
    rowY: (column) => {
      const i = table.columns.findIndex((c) => c.name === column);
      return i < 0 ? top / 2 : top + i * TABLE.colHeight + TABLE.colHeight / 2;
    },
  };
}

/** Size of an enum card: values in rows of two chips. */
export function enumGeometry(data: EnumData): { w: number; h: number } {
  const rows = Math.ceil(data.values.length / 2);
  return {
    w: 200,
    h:
      TABLE.border +
      TABLE.pad +
      TABLE.header +
      TABLE.gap +
      TABLE.title +
      TABLE.gap +
      22 * rows +
      4 * (rows - 1) +
      TABLE.pad +
      TABLE.border,
  };
}

/** Anything a relationship can end on: its box and the y of a column row inside it. */
export interface Endpoint {
  x: number;
  y: number;
  w: number;
  rowY: (column: string) => number;
}

export interface RelationshipLayout {
  d: string;
  start: Point;
  end: Point;
  ends: readonly CrowFoot[];
}

/**
 * The curve of a relationship from `from`'s column row to `to`'s, leaving each card on the side
 * that faces the other (both right when they overlap), with a crow's foot at each end.
 */
export function layoutRelationship(
  rel: Relationship,
  from: Endpoint,
  to: Endpoint,
): RelationshipLayout {
  let sides: readonly [Side, Side];
  if (rel.sides !== undefined) sides = rel.sides;
  else if (from.x + from.w <= to.x) sides = ['r', 'l'];
  else if (to.x + to.w <= from.x) sides = ['l', 'r'];
  else sides = ['r', 'r'];
  const [s1, s2] = sides;
  const edgeX = (box: Endpoint, side: Side): number => (side === 'l' ? box.x : box.x + box.w);
  const start = { x: edgeX(from, s1), y: from.y + from.rowY(rel.fromColumn) };
  const end = { x: edgeX(to, s2), y: to.y + to.rowY(rel.toColumn) };
  const path = curve(start, s1, end, s2);
  return {
    d: path.d,
    start,
    end,
    ends: [crowFoot(start, normal(s1), rel.fromEnd), crowFoot(end, normal(s2), rel.toEnd)],
  };
}
