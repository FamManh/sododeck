/**
 * Arrange tables: lays a set of tables out with the deck's auto-layout (ELK, in its worker), their
 * relationships on rows (`layoutEdgeOf`), and puts the result back where the tables were, clear of
 * everything else at their level. "Arrange tables" on a selection and the DBML tab's paste use it.
 * The request and the placement are pure; the layout itself runs off the main thread.
 */
import type { Point } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import type { LayoutRequest, LayoutResult } from '../layout/elk-layout';
import { cardBox, type Rect } from './canvas-geometry';
import { layoutEdgeOf } from './relationships/layout-edge';
import { tableContextOf } from './table-keys';

/** Space kept between the arranged tables and the cards around them. */
export const ARRANGE_GAP = 80;

/** The layout request for `ids` (tables) and the relationships between them. */
export function arrangeRequest(deck: SododeckFile, ids: readonly Id[]): LayoutRequest {
  const wanted = new Set(ids);
  const context = tableContextOf(deck);
  const nodesById = new Map(deck.nodes.map((n) => [n.id, n]));
  const nodes: LayoutRequest['nodes'] = [];
  deck.nodes.forEach((node, index) => {
    if (!wanted.has(node.id)) return;
    const { width, height } = cardBox(node, index, 'system', { table: context });
    nodes.push({ id: node.id, width, height });
  });
  const edges = deck.edges
    .filter((e) => e.from !== e.to && wanted.has(e.from) && wanted.has(e.to))
    .map((e) => layoutEdgeOf(e, nodesById, context));
  return { nodes, groups: [], edges, pinned: {} };
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width + ARRANGE_GAP &&
  b.x < a.x + a.width + ARRANGE_GAP &&
  a.y < b.y + b.height + ARRANGE_GAP &&
  b.y < a.y + a.height + ARRANGE_GAP;

/**
 * Positions from a layout `result`: the arranged cluster keeps the top-left corner the tables had
 * together, then moves right past any other card at their level it would cover.
 */
export function placeArranged(
  deck: SododeckFile,
  ids: readonly Id[],
  result: LayoutResult,
): Map<Id, Point> {
  const wanted = new Set(ids);
  const context = tableContextOf(deck);
  const before: Rect[] = [];
  const after: { id: Id; box: Rect }[] = [];
  const parents = new Set<Id | undefined>();
  deck.nodes.forEach((node, index) => {
    if (!wanted.has(node.id)) return;
    parents.add(node.parent);
    const box = cardBox(node, index, 'system', { table: context });
    before.push(box);
    const at = result[node.id];
    if (at !== undefined) after.push({ id: node.id, box: { ...box, x: at.x, y: at.y } });
  });
  const out = new Map<Id, Point>();
  if (after.length === 0) return out;
  const obstacles: Rect[] = [];
  deck.nodes.forEach((node, index) => {
    if (wanted.has(node.id) || !parents.has(node.parent)) return;
    obstacles.push(cardBox(node, index, 'system', { table: context }));
  });

  const left = (rects: readonly Rect[]) => Math.min(...rects.map((r) => r.x));
  const top = (rects: readonly Rect[]) => Math.min(...rects.map((r) => r.y));
  const boxes = after.map((a) => a.box);
  const dy = top(before) - top(boxes);
  let dx = left(before) - left(boxes);
  for (let guard = 0; guard <= obstacles.length; guard++) {
    const moved = boxes.map((r) => ({ ...r, x: r.x + dx, y: r.y + dy }));
    const hit = obstacles.filter((o) => moved.some((r) => overlaps(r, o)));
    if (hit.length === 0) break;
    dx += Math.max(...hit.map((o) => o.x + o.width)) + ARRANGE_GAP - left(moved);
  }
  for (const { id, box } of after) {
    out.set(id, { x: Math.round(box.x + dx), y: Math.round(box.y + dy) });
  }
  return out;
}
