/**
 * Paste a clipboard fragment (016 research R10, ADR 0017). Every object gets a new id and every
 * reference inside the fragment is remapped; references that leave it go to `parent` (groups and
 * members) or are dropped (rules the deck does not have). One transaction: one undo step.
 */
import type { Edge, Group, Id, Node } from '@sododeck/schema';
import * as Y from 'yjs';

import { toY, type YObject } from '../convert';
import type { Fragment } from '../fragment';
import type { Point } from '../geometry';
import { anchorableIds } from '../ids';
import { collectionArray, rulesMap } from '../layout';
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
    };
  });
  const edges: Edge[] = deck.edges.flatMap((edge) => {
    const from = nodeIds.get(edge.from);
    const to = nodeIds.get(edge.to);
    return from === undefined || to === undefined
      ? []
      : [{ ...edge, id: ctx.allocate('edge'), from, to }];
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
    collectionArray(ctx.doc, 'groups').push(groups.map((g) => toY(g) as YObject));
    collectionArray(ctx.doc, 'nodes').push(nodes.map((n) => toY(n) as YObject));
    collectionArray(ctx.doc, 'edges').push(edges.map((e) => toY(e) as YObject));
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
