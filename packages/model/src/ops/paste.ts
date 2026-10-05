/**
 * Paste a clipboard fragment (016 research R10, ADR 0017). Every object gets a new id and every
 * reference inside the fragment is remapped; references that leave it go to `parent` (groups and
 * members) or are dropped (rules the deck does not have). One transaction: one undo step.
 *
 * Tables (040, research R10): every column, index and check gets a new id too, and index parts
 * and the pasted edges' `fromColumns` / `toColumns` follow the same map.
 *
 * Duplicate and paste of tables (043, research R10), all in the same transaction:
 * - `external` relationships (from a copied table to one outside the copy) are kept, remapped on
 *   the from side only, when the target deck has their `to` table and its `toColumns`; the others
 *   are dropped and counted in `droppedRelationships`. So a duplicate keeps its foreign keys and
 *   a paste into a deck without the target does not leave dangling ones.
 * - `enums` are linked to a target enum of the same name and schema (case-insensitive), else
 *   copied with new enum and value ids; `enumRef` follows. An `enumRef` the fragment carries no
 *   enum for (pre-043 fragments) is kept, as before: it resolves in the same deck.
 * - A `db-table` whose name is taken in its schema (case-insensitive) is renamed `name_copy`,
 *   `name_copy_2`… (`copyName`). Other cards keep their titles.
 */
import type { DbEnum, DbIndexPart, Edge, Group, Id, Image, Node, Sticky } from '@sododeck/schema';
import * as Y from 'yjs';

import { isDbTable } from '../card-types';
import { toY } from '../convert';
import type { Fragment } from '../fragment';
import type { Point } from '../geometry';
import { appendAll, collectionMap, rulesMap } from '../layout';
import { sortStack } from '../stack-order';
import { readEnums, readObject } from '../read';
import { createEnum, createObject } from '../write';
import { assertRefsExist, assertValid, validateObject } from '../validate';
import type { EditContext } from './context';
import { attachedEnums } from './db-enums';
import { materializeFrames } from './frames';
import { writeAssetMeta } from './images';
import { topRankOf, usesRanks } from './stacking';
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
  /** The new images (055), in the order they stack. */
  images: Id[];
  /** The new notes, free notes in fragment order. */
  stickies: Id[];
  /**
   * External relationships of the fragment not pasted because the target deck lacks their target
   * table or its columns (043 FR-019). 0 when none were dropped.
   */
  droppedRelationships: number;
}

const shift = (point: Point, by: Point): Point => ({ x: point.x + by.x, y: point.y + by.y });

/** Name lookup key: case-insensitive name within a case-insensitive schema (absent = default). */
const nameKey = (name: string, schema: string | undefined) =>
  `${(schema ?? '').toLowerCase()}\u0000${name.toLowerCase()}`;

function freeCopyName(name: string, isTaken: (candidate: string) => boolean): string {
  let candidate = `${name}_copy`;
  for (let n = 2; isTaken(candidate); n++) candidate = `${name}_copy_${String(n)}`;
  return candidate;
}

/**
 * The name for a copy of `name` when `name` is taken (043 FR-020): `name_copy`, then
 * `name_copy_2`, `name_copy_3`… the first one not in `taken`, compared case-insensitively.
 */
export function copyName(name: string, taken: ReadonlySet<string>): string {
  const lower = new Set([...taken].map((t) => t.toLowerCase()));
  return freeCopyName(name, (candidate) => lower.has(candidate.toLowerCase()));
}

/** Name keys of the target deck's tables. */
function tableNameKeys(ctx: EditContext): Set<string> {
  const keys = new Set<string>();
  for (const [id, map] of collectionMap(ctx.doc, 'nodes')) {
    const node = readObject('nodes', id, map) as unknown as Node;
    if (isDbTable(node)) keys.add(nameKey(node.title, node.schema));
  }
  return keys;
}

/**
 * Fragment enum id → target enum id: a same-named enum of the target in the same schema, or a
 * copy with new enum and value ids (returned in `created`, to be written with the paste).
 */
function linkEnums(
  ctx: EditContext,
  enums: readonly DbEnum[],
): { ids: Map<Id, Id>; created: DbEnum[] } {
  const ids = new Map<Id, Id>();
  const created: DbEnum[] = [];
  if (enums.length === 0) return { ids, created };
  const byName = new Map<string, Id>();
  for (const item of readEnums(ctx.doc) ?? []) {
    const key = nameKey(item.name, item.schema);
    if (!byName.has(key)) byName.set(key, item.id);
  }
  for (const item of enums) {
    const key = nameKey(item.name, item.schema);
    const linked = byName.get(key);
    if (linked !== undefined) {
      ids.set(item.id, linked);
      continue;
    }
    const copy: DbEnum = {
      ...item,
      id: ctx.allocate('enum'),
      values: item.values.map((value) => ({ ...value, id: ctx.allocate('enumval') })),
    };
    ids.set(item.id, copy.id);
    // A second fragment enum of the same name links to this copy rather than copying again.
    byName.set(key, copy.id);
    created.push(copy);
  }
  return { ids, created };
}

/** Column ids of the target deck's table `id`, or undefined when it is not a table there. */
function targetColumns(ctx: EditContext, id: Id): Set<Id> | undefined {
  const map = collectionMap(ctx.doc, 'nodes').get(id);
  if (map === undefined) return undefined;
  const node = readObject('nodes', id, map) as unknown as Node;
  if (!isDbTable(node)) return undefined;
  return new Set((node.columns ?? []).map((c) => c.id));
}

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

/**
 * A node's table lists with new part ids, remapped index parts and linked or copied enums (absent
 * lists stay absent).
 */
function remapTableParts(
  node: Node,
  ids: ReadonlyMap<Id, Id>,
  enumIds: ReadonlyMap<Id, Id>,
): Partial<Node> {
  const to = (id: Id) => ids.get(id) ?? id;
  const part = (item: DbIndexPart): DbIndexPart => (typeof item === 'string' ? to(item) : item);
  return {
    ...(node.columns === undefined
      ? {}
      : {
          columns: node.columns.map(({ enumRef, ...c }) => ({
            ...c,
            id: to(c.id),
            ...(enumRef === undefined ? {} : { enumRef: enumIds.get(enumRef) ?? enumRef }),
          })),
        }),
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
    assertRefsExist(ctx.doc, [{ path: 'parent', id: parent, target: 'groups' }]);
  }
  const view = options.viewId === undefined ? undefined : resolveView(ctx, options.viewId);
  const fragmentImages = fragment.images ?? [];
  if (deck.nodes.length + deck.groups.length + fragmentImages.length + deck.stickies.length === 0) {
    return { nodes: [], edges: [], groups: [], images: [], stickies: [], droppedRelationships: 0 };
  }

  const nodeIds = new Map(deck.nodes.map((n) => [n.id, ctx.allocate('node')]));
  const imageIds = new Map(fragmentImages.map((i) => [i.id, ctx.allocate('img')]));
  const groupIds = new Map(deck.groups.map((g) => [g.id, ctx.allocate('group')]));
  const stickyIds = new Map(deck.stickies.map((s) => [s.id, ctx.allocate('sticky')]));
  const knownRules = new Set(rulesMap(ctx.doc).keys());
  const partIds = partIdMap(ctx, deck.nodes);
  const toPart = (id: Id) => partIds.get(id) ?? id;
  const enums = linkEnums(ctx, fragment.enums ?? []);
  const takenNames = deck.nodes.some(isDbTable) ? tableNameKeys(ctx) : new Set<string>();
  /** The pasted title: a taken table name gets `_copy…`, and every pasted table name is taken. */
  const titleOf = (node: Node): string => {
    if (!isDbTable(node)) return node.title;
    const taken = (name: string) => takenNames.has(nameKey(name, node.schema));
    const title = taken(node.title) ? freeCopyName(node.title, taken) : node.title;
    takenNames.add(nameKey(title, node.schema));
    return title;
  };

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
  // Pasted items stack above everything already there, in the order they stacked in the source
  // (055). The source `z` is dropped: it ranks against another deck. A deck that ranks nothing
  // (no images, no `z`) and receives no image keeps array order as its stack.
  const ranked = fragmentImages.length > 0 || usesRanks(ctx.doc);
  const top = topRankOf(ctx.doc);
  const stacked = new Map<string, number>();
  sortStack([
    ...deck.nodes.map((n, i) => ({ kind: 'node' as const, id: n.id, rank: n.z ?? i })),
    ...fragmentImages.map((n, i) => ({ kind: 'image' as const, id: n.id, rank: n.z ?? i })),
  ]).forEach((entry, i) => stacked.set(`${entry.kind}:${entry.id}`, top + i));
  const rankOf = (kind: 'node' | 'image', id: Id) => stacked.get(`${kind}:${id}`) ?? top;
  const byStack = <T extends { id: Id }>(kind: 'node' | 'image', items: readonly T[]): T[] =>
    [...items].sort((a, b) => rankOf(kind, a.id) - rankOf(kind, b.id));

  const nodes: Node[] = byStack('node', deck.nodes).map((node) => {
    const { id, group, parent: container, rules, position, z: _z, ...rest } = node;
    const into = group === undefined ? parent : (groupIds.get(group) ?? parent);
    const inside = container === undefined ? undefined : nodeIds.get(container);
    const kept = rules?.filter((rule) => knownRules.has(rule)) ?? [];
    return {
      ...rest,
      id: nodeIds.get(id) ?? id,
      title: titleOf(node),
      ...(into === undefined ? {} : { group: into }),
      ...(inside === undefined ? {} : { parent: inside }),
      ...(kept.length === 0 ? {} : { rules: kept }),
      ...(position === undefined ? {} : { position: shift(position, offset) }),
      ...remapTableParts(node, partIds, enums.ids),
      ...(ranked ? { z: rankOf('node', id) } : {}),
    };
  });
  const images: Image[] = byStack('image', fragmentImages).map((image) => {
    const { id, group, position, z: _z, ...rest } = image;
    const into = group === undefined ? parent : (groupIds.get(group) ?? parent);
    return {
      ...rest,
      id: imageIds.get(id) ?? id,
      position: shift(position, offset),
      ...(into === undefined ? {} : { group: into }),
      z: rankOf('image', id),
    };
  });
  // Notes are always free (ADR 0041): a legacy `anchor` in a hand-made fragment is dropped.
  const stickies: Sticky[] = deck.stickies.map((sticky) => {
    const { id, anchor: _anchor, position, ...rest } = sticky;
    return {
      ...rest,
      id: stickyIds.get(id) ?? id,
      position: shift(position ?? { x: 0, y: 0 }, offset),
    };
  });
  const remap = (id: Id) =>
    nodeIds.get(id) ?? groupIds.get(id) ?? imageIds.get(id) ?? stickyIds.get(id);
  const edges: Edge[] = deck.edges.flatMap((edge) => {
    // An end is a node, a group (050), a note (053) or an image (055); remap each through its map.
    const from = remap(edge.from);
    const to = remap(edge.to);
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
  let droppedRelationships = 0;
  for (const edge of fragment.external ?? []) {
    const from = nodeIds.get(edge.from);
    const columns = from === undefined ? undefined : targetColumns(ctx, edge.to);
    if (from === undefined || columns === undefined) {
      droppedRelationships++;
      continue;
    }
    const { fromColumns, toColumns } = edge;
    if (toColumns !== undefined && !toColumns.every((c) => columns.has(c))) {
      droppedRelationships++;
      continue;
    }
    edges.push({
      ...edge,
      id: ctx.allocate('edge'),
      from,
      ...(fromColumns === undefined ? {} : { fromColumns: fromColumns.map(toPart) }),
    });
  }

  assertValid([
    ...enums.created.flatMap((e) => validateObject('enum', e)),
    ...groups.flatMap((g) => validateObject('groups', g)),
    ...nodes.flatMap((n) => validateObject('nodes', n)),
    ...images.flatMap((i) => validateObject('images', i)),
    ...stickies.flatMap((n) => validateObject('stickies', n)),
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
    const created = (
      kind: 'groups' | 'nodes' | 'edges' | 'stickies',
      items: readonly { id: Id }[],
    ) => items.map((item) => [item.id, createObject(kind, { ...item }, '')] as const);
    // Pictures the target does not know yet get their facts from the fragment; the bytes stay in
    // the app's store (same deck) or are missing (another deck, TODO(M5)).
    for (const [assetId, meta] of Object.entries(fragment.assets ?? {})) {
      if (images.some((image) => image.asset === assetId)) writeAssetMeta(ctx.doc, assetId, meta);
    }
    appendAll(collectionMap(ctx.doc, 'groups'), created('groups', groups));
    appendAll(collectionMap(ctx.doc, 'nodes'), created('nodes', nodes));
    appendAll(
      collectionMap(ctx.doc, 'images'),
      images.map((item) => [item.id, createObject('images', { ...item }, '')] as const),
    );
    appendAll(collectionMap(ctx.doc, 'stickies'), created('stickies', stickies));
    appendAll(collectionMap(ctx.doc, 'edges'), created('edges', edges));
    if (enums.created.length > 0) {
      appendAll(
        attachedEnums(ctx),
        enums.created.map((item) => [item.id, createEnum(item, '')] as const),
      );
    }
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
    images: images.map((i) => i.id),
    stickies: stickies.map((n) => n.id),
    droppedRelationships,
  };
}
