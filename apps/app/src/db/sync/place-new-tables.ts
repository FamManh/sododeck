/**
 * Where tables added from the text go (046 research R12): in a column to the right of the scope's
 * tables, 160 px clear of them, stacked without overlap and checked against every card. Synchronous
 * and simple, so an apply is one write (ELK is async and re-flows nothing that exists). Pure.
 */
import type { Id, Node, SododeckFile } from '@sododeck/schema';

import type { Rect } from './types';

export const PLACE_GAP_X = 160;
export const PLACE_GAP_Y = 40;

export interface Size {
  width: number;
  height: number;
}

export type SizeOf = (node: Node) => Size;

/** A stand-in when the caller gives no measure: the table card's rough height from its rows. */
export const defaultSizeOf: SizeOf = (node) => ({
  width: 240,
  height: 44 + 24 * Math.max(1, node.columns?.length ?? 0),
});

const rectOf = (node: Node, sizeOf: SizeOf): Rect => ({
  x: node.position?.x ?? 0,
  y: node.position?.y ?? 0,
  ...sizeOf(node),
});

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Positions for `added` (complete table nodes), by id. `scopeIds` are the tables the text covers;
 * the column starts to the right of their bounding box, at its top, or at the viewport centre when
 * the deck has no table.
 */
export function placeNewTables(
  deck: SododeckFile,
  scopeIds: readonly Id[],
  added: readonly Node[],
  viewport: Rect,
  sizeOf: SizeOf = defaultSizeOf,
): Map<Id, { x: number; y: number }> {
  const result = new Map<Id, { x: number; y: number }>();
  if (added.length === 0) return result;
  const taken: Rect[] = deck.nodes
    .filter((n) => n.position !== undefined)
    .map((n) => rectOf(n, sizeOf));
  const scope = new Set(scopeIds);
  const inScope = deck.nodes.filter((n) => scope.has(n.id) && n.position !== undefined);
  let x: number;
  let top: number;
  if (inScope.length > 0) {
    const rects = inScope.map((n) => rectOf(n, sizeOf));
    x = Math.max(...rects.map((r) => r.x + r.width)) + PLACE_GAP_X;
    top = Math.min(...rects.map((r) => r.y));
  } else if (
    taken.length > 0 &&
    scope.size === 0 &&
    deck.nodes.some((n) => n.type === 'db-table')
  ) {
    const rects = deck.nodes.filter((n) => n.type === 'db-table').map((n) => rectOf(n, sizeOf));
    x = Math.max(...rects.map((r) => r.x + r.width)) + PLACE_GAP_X;
    top = Math.min(...rects.map((r) => r.y));
  } else {
    x = viewport.x + viewport.width / 2;
    top = viewport.y + viewport.height / 2;
  }
  let y = top;
  for (const node of added) {
    const size = sizeOf(node);
    let box: Rect = { x, y, ...size };
    // Move below whatever the box lands on, until it is clear.
    for (let guard = 0; guard < taken.length + 1; guard++) {
      const hit = taken.find((r) => overlaps(box, r));
      if (hit === undefined) break;
      box = { ...box, y: hit.y + hit.height + PLACE_GAP_Y };
    }
    taken.push(box);
    result.set(node.id, { x: box.x, y: box.y });
    y = box.y + size.height + PLACE_GAP_Y;
  }
  return result;
}
