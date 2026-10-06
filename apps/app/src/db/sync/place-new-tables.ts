/**
 * Where tables added from the text go (046 research R12): to the right of the scope's tables,
 * 160 px clear of them, checked against every card. The new tables are laid out in layers by
 * their relationships (a referenced table left of the tables that point at it), so a pasted schema
 * reads left to right instead of as one tall column. Synchronous and simple, so an apply is one
 * write (ELK is async and re-flows nothing that exists). Pure.
 */
import type { Id, Node, SododeckFile } from '@sododeck/schema';

import type { Rect } from './types';

export const PLACE_GAP_X = 160;
export const PLACE_GAP_Y = 40;
/** A layer taller than this wraps into a further column, so unrelated tables form a grid. */
export const MAX_COLUMN_HEIGHT = 1600;

export interface Size {
  width: number;
  height: number;
}

export type SizeOf = (node: Node) => Size;

/** A relationship between two new tables: `parent` is the referenced (one) end. */
export interface PlaceLink {
  parent: Id;
  child: Id;
}

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
  links: readonly PlaceLink[] = [],
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
  for (const { node, at } of layeredLayout(added, links, sizeOf)) {
    let box: Rect = { x: x + at.x, y: top + at.y, ...sizeOf(node) };
    // Move below whatever the box lands on, until it is clear.
    for (let guard = 0; guard < taken.length + 1; guard++) {
      const hit = taken.find((r) => overlaps(box, r));
      if (hit === undefined) break;
      box = { ...box, y: hit.y + hit.height + PLACE_GAP_Y };
    }
    taken.push(box);
    result.set(node.id, { x: box.x, y: box.y });
  }
  return result;
}

/**
 * Offsets of `nodes` from the cluster's top-left: one column per layer, a layer one step right of
 * the tables it references. Cycles are broken by a depth-first walk from the tables that reference
 * nothing; inside a layer, tables sit in the order of their parents' heights so lines cross less.
 */
export function layeredLayout(
  nodes: readonly Node[],
  links: readonly PlaceLink[],
  sizeOf: SizeOf,
): { node: Node; at: { x: number; y: number } }[] {
  const ids = new Set(nodes.map((n) => n.id));
  const children = new Map<Id, Id[]>();
  const hasParent = new Set<Id>();
  for (const { parent, child } of links) {
    if (parent === child || !ids.has(parent) || !ids.has(child)) continue;
    const list = children.get(parent);
    if (list === undefined) children.set(parent, [child]);
    else list.push(child);
    hasParent.add(child);
  }

  // Keep only forward edges: a walk from the roots drops the ones that close a cycle.
  const parents = new Map<Id, Id[]>();
  const done = new Set<Id>();
  const onPath = new Set<Id>();
  const walk = (id: Id) => {
    done.add(id);
    onPath.add(id);
    for (const child of children.get(id) ?? []) {
      if (onPath.has(child)) continue;
      const list = parents.get(child);
      if (list === undefined) parents.set(child, [id]);
      else list.push(id);
      if (!done.has(child)) walk(child);
    }
    onPath.delete(id);
  };
  const roots = nodes.filter((n) => !hasParent.has(n.id));
  for (const node of [...roots, ...nodes]) if (!done.has(node.id)) walk(node.id);

  // Longest path from a root: a table sits right of every table it references.
  const layerOf = new Map<Id, number>();
  const layer = (id: Id): number => {
    const known = layerOf.get(id);
    if (known !== undefined) return known;
    const value = Math.max(-1, ...(parents.get(id) ?? []).map(layer)) + 1;
    layerOf.set(id, value);
    return value;
  };
  const layers: Node[][] = [];
  for (const node of nodes) (layers[layer(node.id)] ??= []).push(node);

  const centre = new Map<Id, number>();
  const out: { node: Node; at: { x: number; y: number } }[] = [];
  let x = 0;
  for (const members of layers) {
    // Barycentre of the parents already placed; tables without one keep their text order last.
    const weight = (node: Node) => {
      const ys = (parents.get(node.id) ?? []).flatMap((p) => centre.get(p) ?? []);
      return ys.length === 0 ? Infinity : ys.reduce((a, b) => a + b, 0) / ys.length;
    };
    const ordered = members
      .map((node, index) => ({ node, index, weight: weight(node) }))
      .sort((a, b) => a.weight - b.weight || a.index - b.index);
    let y = 0;
    let width = 0;
    for (const { node } of ordered) {
      const size = sizeOf(node);
      if (y > 0 && y + size.height > MAX_COLUMN_HEIGHT) {
        x += width + PLACE_GAP_X;
        y = 0;
        width = 0;
      }
      out.push({ node, at: { x, y } });
      centre.set(node.id, y + size.height / 2);
      y += size.height + PLACE_GAP_Y;
      width = Math.max(width, size.width);
    }
    x += width + PLACE_GAP_X;
  }
  return out;
}
