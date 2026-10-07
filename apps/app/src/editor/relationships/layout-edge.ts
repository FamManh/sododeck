/**
 * A connection as the layout sees it (ELK, `layout/elk-layout.ts`). A table relationship runs from
 * the referenced table to the one that points at it, so the layout puts referenced tables first
 * (left), and carries the rows its ends sit on, so tables line up by the rows they link. Tidy, the
 * import, the DBML tab and "Arrange tables" all build their edges here. Pure.
 */
import { isDbTable } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import type { LayoutEdge } from '../../layout/elk-layout';
import { tableLayoutOf } from '../canvas-geometry';
import type { TableContext } from '../table-keys';
import { isRelationship, relationshipEnds } from './relationship-ends';

type Edge = SododeckFile['edges'][number];
type Node = SododeckFile['nodes'][number];

const middle = (offsets: readonly number[]) =>
  offsets.length === 0 ? undefined : offsets.reduce((a, b) => a + b, 0) / offsets.length;

/**
 * `edge` for the layout, between `source` and `target` (the ids the layout knows the ends by:
 * the ends themselves unless the caller draws them as something else).
 */
export function layoutEdgeOf(
  edge: Edge,
  nodesById: ReadonlyMap<Id, Node>,
  context: TableContext,
  source: string = edge.from,
  target: string = edge.to,
): LayoutEdge {
  const isTable = (id: Id) => {
    const node = nodesById.get(id);
    return node !== undefined && isDbTable(node);
  };
  const fromNode = nodesById.get(edge.from);
  const toNode = nodesById.get(edge.to);
  if (
    fromNode === undefined ||
    toNode === undefined ||
    source !== edge.from ||
    target !== edge.to ||
    !isRelationship(edge, isTable)
  ) {
    return { id: edge.id, source, target };
  }
  const ends = relationshipEnds(
    edge,
    tableLayoutOf(fromNode, context),
    tableLayoutOf(toNode, context),
  );
  const fromY = middle(ends.from.offsets);
  const toY = middle(ends.to.offsets);
  // `from` holds the foreign key unless the relationship reads one-to-many from it.
  const referenced = edge.cardinality === '1-n' ? 'from' : 'to';
  const [first, firstY, second, secondY] =
    referenced === 'to' ? [edge.to, toY, edge.from, fromY] : [edge.from, fromY, edge.to, toY];
  return {
    id: edge.id,
    source: first,
    target: second,
    ...(firstY === undefined ? {} : { sourceY: firstY }),
    ...(secondY === undefined ? {} : { targetY: secondY }),
  };
}
