/**
 * Paste a clipboard fragment (016 research R10, ADR 0017). Every object gets a new id and every
 * reference inside the fragment is remapped; references that leave it go to `parent` (groups and
 * members) or are dropped (rules the deck does not have). One transaction: one undo step.
 *
 * Tables (040, research R10): every column, index and check gets a new id too, and index parts
 * and the pasted edges' `fromColumns` / `toColumns` follow the same map. `enumRef` is kept: enums
 * are deck-level, so it still resolves in the same deck (and is reported dangling in another).
 */
import type { DbIndexPart, Edge, Group, Id, Node } from '@sododeck/schema';
import * as Y from 'yjs';

import { toY } from '../convert';
import type { Fragment } from '../fragment';
import type { Point } from '../geometry';
import { anchorableIds } from '../ids';
import { appendAll, collectionMap, rulesMap } from '../layout';
import { createObject } from '../write';
import { assertRefsExist, assertValid, validateObject } from '../validate';
import type { EditContext } from './context';
import { materializeFrames } from './frames';
import { resolveView, viewMap } from './views';

export interface PasteOptions {
  /** Added to every position and frame of the fragment. */
  offset: Point;
  /** Group that receives the fragment's top-level nodes and groups; none when absent. */
  parent?: Id;
  /** The view pasted into: a non-base view also gets view positions and frames. */
  viewId?: Id;
}

export interface PastedIds {
  nodes: Id[];
  edges: Id[];
  groups: Id[];
}

const shift = (point: Point, by: Point): Point => ({ x: point.x + by.x, y: point.y + by.y });

/** New ids for every column, index and check of the fragment's nodes (040). */
function partIdMap(ctx: EditContext, nodes: readonly Node[]): Map<Id, Id> {
  const ids = new Map<Id, Id>();
  for (const node of nodes) {
    for (const column of node.columns ?? []) ids.set(column.id, ctx.allocate('dbcol'));
    for (const index of node.indexes ?? []) ids.set(index.id, ctx.allocate('dbidx'));
    for (const check of node.checks ?? []) ids.set(check.id, ctx.allocate('dbchk'));
  }
  return ids;
}

/** A node's table lists with new part ids and remapped index parts (absent lists stay absent). */
function remapTableParts(node: Node, ids: ReadonlyMap<Id, Id>): Partial<Node> {
  const to = (id: Id) => ids.get(id) ?? id;
  const part = (item: DbIndexPart): DbIndexPart => (typeof item === 'string' ? to(item) : item);
  return {
    ...(node.columns === undefined
      ? {}
      : { columns: node.columns.map((c) => ({ ...c, id: to(c.id) })) }),
    ...(node.indexes === undefined
      ? {}
      : {
          indexes: node.indexes.map((i) => ({ ...i, id: to(i.id), columns: i.columns.map(part) })),
        }),
    ...(node.checks === undefined
      ? {}
      : { checks: node.checks.map((c) => ({ ...c, id: to(c.id) })) }),
  };
}

/** Parents before children, so the order reads naturally in the file; cycles keep file order. */
function parentsFirst(groups: readonly Group[]): Group[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const out: Group[] = [];
  const placed = new Set<Id>();
  const visit = (group: Group, seen: ReadonlySet<Id>) => {
    if (placed.has(group.id)) return;
    const parent = group.parent === undefined ? undefined : byId.get(group.parent);
    if (parent !== undefined && !seen.has(parent.id)) visit(parent, new Set(seen).add(group.id));
    if (placed.has(group.id)) return;
    placed.add(group.id);
    out.push(group);
  };
  for (const group of groups) visit(group, new Set());
  return out;
}

function writeViewFrame(frames: Y.Map<unknown>, id: Id, group: Group): void {
  if (group.position === undefined || group.size === undefined) return;
  frames.set(id, toY({ position: group.position, size: group.size }));
}

export function pasteFragment(
  ctx: EditContext,
  fragment: Fragment,
  options: PasteOptions,
): PastedIds {
  const { deck } = fragment;
  const { offset, parent } = options;
  if (parent !== undefined) {
    assertRefsExist(ctx.doc, [{ path: 'parent', id: parent, target: 'groups' }], () =>
      anchorableIds(ctx.doc),
    );
  }
  const view = options.viewId === undefined ? undefined : resolveView(ctx, options.viewId);
  if (deck.nodes.length + deck.groups.length === 0) return { nodes: [], edges: [], groups: [] };

  const nodeIds = new Map(deck.nodes.map((n) => [n.id, ctx.allocate('node')]));
  const groupIds = new Map(deck.groups.map((g) => [g.id, ctx.allocate('group')]));
  const knownRules = new Set(rulesMap(ctx.doc).keys());
  const partIds = partIdMap(ctx, deck.nodes);
  const toPart = (id: Id) => partIds.get(id) ?? id;

  const groups: Group[] = parentsFirst(deck.groups).map((group) => {
    const { id, parent: from, position, size, ...rest } = group;
    const into = from === undefined ? parent : (groupIds.get(from) ?? parent);
    return {
      ...rest,
      id: groupIds.get(id) ?? id,
      ...(into === undefined ? {} : { parent: into }),
      ...(position === undefined || size === undefined
        ? {}
        : { position: shift(position, offset), size }),
    };
  });
  const nodes: Node[] = deck.nodes.map((node) => {
    const { id, group, parent: container, rules, position, ...rest } = node;
    const into = group === undefined ? parent : (groupIds.get(group) ?? parent);
    const inside = container === undefined ? undefined : nodeIds.get(container);
    const kept = rules?.filter((rule) => knownRules.has(rule)) ?? [];
    return {
      ...rest,
      id: nodeIds.get(id) ?? id,
      ...(into === undefined ? {} : { group: into }),
      ...(inside === undefined ? {} : { parent: inside }),
      ...(kept.length === 0 ? {} : { rules: kept }),
      ...(position === undefined ? {} : { position: shift(position, offset) }),
      ...remapTableParts(node, partIds),
    };
  });
  const edges: Edge[] = deck.edges.flatMap((edge) => {
    // An end is a node or a group (050); remap either through its map.
    const from = nodeIds.get(edge.from) ?? groupIds.get(edge.from);
    const to = nodeIds.get(edge.to) ?? groupIds.get(edge.to);
    if (from === undefined || to === undefined) return [];
    const { fromColumns, toColumns } = edge;
    return [
      {
        ...edge,
        id: ctx.allocate('edge'),
        from,
        to,
        ...(fromColumns === undefined ? {} : { fromColumns: fromColumns.map(toPart) }),
        ...(toColumns === undefined ? {} : { toColumns: toColumns.map(toPart) }),
      },
    ];
  });

  assertValid([
    ...groups.flatMap((g) => validateObject('groups', g)),
    ...nodes.flatMap((n) => validateObject('nodes', n)),
    ...edges.flatMap((e) => validateObject('edges', e)),
  ]);

  // A non-base view stores its own positions and frames: store its presets and frames first
  // (untracked, as any first view edit does), then write the copies into it with the paste.
  const viewTarget =
    view !== undefined && view.index > 0 && options.viewId !== undefined
      ? viewMap(ctx, options.viewId)
      : undefined;
  if (viewTarget !== undefined) materializeFrames(ctx, viewTarget);

  ctx.transact(() => {
    const created = (kind: 'groups' | 'nodes' | 'edges', items: readonly { id: Id }[]) =>
      items.map((item) => [item.id, createObject(kind, { ...item }, '')] as const);
    appendAll(collectionMap(ctx.doc, 'groups'), created('groups', groups));
    appendAll(collectionMap(ctx.doc, 'nodes'), created('nodes', nodes));
    appendAll(collectionMap(ctx.doc, 'edges'), created('edges', edges));
    if (viewTarget === undefined) return;
    let positions = viewTarget.get('positions');
    if (!(positions instanceof Y.Map)) {
      positions = new Y.Map();
      viewTarget.set('positions', positions);
    }
    for (const node of nodes) {
      if (node.position !== undefined) {
        (positions as Y.Map<unknown>).set(node.id, toY(node.position));
      }
    }
    const frames = viewTarget.get('groupFrames');
    if (frames instanceof Y.Map) {
      for (const group of groups) writeViewFrame(frames as Y.Map<unknown>, group.id, group);
    }
  });
  return {
    nodes: nodes.map((n) => n.id),
    edges: edges.map((e) => e.id),
    groups: groups.map((g) => g.id),
  };
}
