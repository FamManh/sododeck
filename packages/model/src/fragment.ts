/**
 * Clipboard fragments (016 research R9, ADR 0017): the copied nodes, edges and groups as a valid
 * `.sododeck.json` file inside a small envelope, `{ "sododeckFragment": 1, "deck": … }`. Built and
 * parsed here so the app never converts deck data itself (constitution II), and validated with
 * the file parser, so a fragment is valid by construction and plain text is ignored.
 *
 * 043 (research R10) adds two optional envelope keys, with no version bump: `external`, the
 * relationships from a copied table to a table outside the copy (kept on paste only when the
 * target deck has that table and its columns), and `enums`, the enums the copied columns name
 * (linked by name or copied on paste). A fragment without them still parses and pastes.
 *
 * 055 adds two more optional envelope keys, with no version bump: `images`, the copied images
 * (their own key, so the deck inside stays a file that needs no picture bytes), and `assets`, the
 * stored facts about the pictures they use (type, size, name; never the bytes). Pasting into the
 * same deck shows the pictures at once; into another deck the records are kept and the pictures
 * show as missing (TODO(M5): carry the bytes across decks).
 */
import {
  emptySododeckFile,
  parseSododeckFile,
  type DbEnum,
  type Edge,
  type Group,
  type Id,
  type Image,
  type Node,
  type SododeckFile,
  type Sticky,
} from '@sododeck/schema';

import { metaOf, type AssetMeta } from './assets';
import { isDbTable } from './card-types';
import { frameOf, NODE_GRID, stickyPosition, viewNodePosition, type Point } from './geometry';
import { canonicalize, canonicalizeEntry } from './key-order';
import { checkDuplicateIds } from './load-checks';
import { validateObject } from './validate';

export interface Fragment {
  sododeckFragment: 1;
  /**
   * Only nodes, edges, groups and notes (`stickies`, as free notes); every other collection is
   * empty.
   */
  deck: SododeckFile;
  /**
   * Relationships from a copied table to a table outside the copy, ids as in the source deck
   * (043). Present only with `keepOutgoing` and when there is at least one.
   */
  external?: Edge[];
  /** The source deck's enums that the copied columns name (043). Absent when there are none. */
  enums?: DbEnum[];
  /** The copied images, ids and `z` as in the source deck (055). Absent when there are none. */
  images?: Image[];
  /** What the source deck stores about the pictures `images` use, no bytes (055). */
  assets?: Record<Id, AssetMeta>;
}

export interface FragmentOptions {
  /** The view whose positions and frames are copied; the base view's when absent. */
  viewId?: Id;
  /**
   * Also carry relationships that leave the copy from a copied table (043 FR-018), for duplicate
   * and copy. Incoming relationships are never carried.
   */
  keepOutgoing?: boolean;
}

export interface FragmentSelection {
  nodes: readonly Id[];
  groups: readonly Id[];
  /** Images to copy (055); absent means none. */
  images?: readonly Id[];
  /** Notes to copy; absent means none. Copied at their own point; a legacy `anchor` is dropped. */
  stickies?: readonly Id[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A relationship (as the app draws one): an edge between two tables with column ends on either
 * side, or with a cardinality.
 */
function isRelationship(edge: Edge, isTable: (id: Id) => boolean): boolean {
  if (!isTable(edge.from) || !isTable(edge.to)) return false;
  return (
    (edge.fromColumns?.length ?? 0) > 0 ||
    (edge.toColumns?.length ?? 0) > 0 ||
    edge.cardinality !== undefined
  );
}

/**
 * The fragment of `selection` in `file` (R10): the selected nodes, the edges with both ends (nodes,
 * or kept groups since 050) in it, and the selected groups whose whole subtree (members and nested
 * groups) is selected, with their frames. References that leave the fragment (`group`, `parent`)
 * are dropped; rule ids stay and are resolved on paste. Positions and frames are the ones the view
 * draws (the base view's when absent); a node without a position gets its grid slot. The enums
 * the copied columns name, and with `keepOutgoing` the relationships leaving a copied table, go
 * into `enums` and `external` (043). `options` may be a bare view id (the pre-043 form).
 */
export function toFragment(
  file: SododeckFile,
  selection: FragmentSelection,
  options: Id | FragmentOptions = {},
): Fragment {
  const { viewId, keepOutgoing = false } =
    typeof options === 'string' ? { viewId: options } : options;
  const view = viewId === undefined ? undefined : file.views.find((v) => v.id === viewId);
  const nodeIds = new Set(selection.nodes);
  const imageIds = new Set(selection.images ?? []);
  const named = new Set(selection.groups);

  // Cards and images are both members of a group: a group is whole when all of them are selected.
  const members = new Map<Id, Id[]>();
  for (const member of [...file.nodes, ...(file.images ?? [])]) {
    if (member.group === undefined) continue;
    members.set(member.group, [...(members.get(member.group) ?? []), member.id]);
  }
  const children = new Map<Id, Id[]>();
  for (const group of file.groups) {
    if (group.parent === undefined) continue;
    children.set(group.parent, [...(children.get(group.parent) ?? []), group.id]);
  }
  const whole = new Map<Id, boolean>();
  const isWhole = (id: Id, seen: ReadonlySet<Id>): boolean => {
    const known = whole.get(id);
    if (known !== undefined) return known;
    if (!named.has(id) || seen.has(id)) return false;
    const next = new Set(seen).add(id);
    const ok =
      (members.get(id) ?? []).every((n) => nodeIds.has(n) || imageIds.has(n)) &&
      (children.get(id) ?? []).every((g) => isWhole(g, next));
    whole.set(id, ok);
    return ok;
  };
  const groupIds = new Set(file.groups.filter((g) => isWhole(g.id, new Set())).map((g) => g.id));

  const groups: Group[] = file.groups
    .filter((g) => groupIds.has(g.id))
    .map(({ parent, position, size, ...group }) => {
      const frame = view?.groupFrames?.[group.id] ?? frameOf({ position, size });
      return {
        ...group,
        ...(parent !== undefined && groupIds.has(parent) ? { parent } : {}),
        ...(frame === undefined ? {} : { position: frame.position, size: frame.size }),
      };
    });
  const nodes: Node[] = [];
  file.nodes.forEach((node, index) => {
    if (!nodeIds.has(node.id)) return;
    const { group, parent, position: _position, ...rest } = node;
    const at = (view === undefined ? node.position : viewNodePosition(view, node)) ?? {
      x: (index % NODE_GRID.columns) * NODE_GRID.dx,
      y: Math.floor(index / NODE_GRID.columns) * NODE_GRID.dy,
    };
    nodes.push({
      ...rest,
      ...(group !== undefined && groupIds.has(group) ? { group } : {}),
      ...(parent !== undefined && nodeIds.has(parent) ? { parent } : {}),
      position: { x: at.x, y: at.y },
    });
  });
  const stickyIds = new Set(selection.stickies ?? []);
  // Notes are always free (ADR 0041); a legacy `anchor` is dropped so the copy lands where it is.
  const stickies: Sticky[] = file.stickies
    .filter((sticky) => stickyIds.has(sticky.id))
    .map((sticky) => {
      const at = stickyPosition(sticky);
      const { anchor: _anchor, position: _position, ...rest } = sticky;
      return { ...rest, position: { x: at.x, y: at.y } };
    });
  const images: Image[] = (file.images ?? [])
    .filter((image) => imageIds.has(image.id))
    .map(({ group, ...image }) => ({
      ...image,
      ...(group !== undefined && groupIds.has(group) ? { group } : {}),
    }));
  const pictures = Object.fromEntries(
    [...new Set(images.map((image) => image.asset))].flatMap((id) => {
      const stored = file.assets?.[id];
      return stored === undefined ? [] : [[id, metaOf(stored)] as const];
    }),
  );
  // An end is a node, a group (050), a note (053) or an image (055): keep an edge when both ends
  // are in.
  const inside = (id: Id) =>
    nodeIds.has(id) || groupIds.has(id) || imageIds.has(id) || stickyIds.has(id);
  const edges: Edge[] = file.edges.filter((e) => inside(e.from) && inside(e.to));

  const tables = new Set(file.nodes.filter(isDbTable).map((n) => n.id));
  const isTable = (id: Id) => tables.has(id);
  const external = keepOutgoing
    ? file.edges.filter((e) => nodeIds.has(e.from) && !inside(e.to) && isRelationship(e, isTable))
    : [];
  const enumRefs = new Set(nodes.flatMap((n) => (n.columns ?? []).map((c) => c.enumRef)));
  const enums = (file.enums ?? []).filter((e) => enumRefs.has(e.id));

  return {
    sododeckFragment: 1,
    deck: canonicalize({
      ...emptySododeckFile(),
      name: 'Fragment',
      nodes,
      groups,
      edges,
      stickies,
    }),
    ...(images.length === 0
      ? {}
      : {
          images: images.map((image) => canonicalizeEntry('images', image)),
          assets: pictures,
        }),
    ...(external.length === 0
      ? {}
      : { external: external.map((e) => canonicalizeEntry('edges', e)) }),
    ...(enums.length === 0 ? {} : { enums: enums.map((e) => canonicalizeEntry('enums', e)) }),
  };
}

/** The clipboard text of a fragment (canonical key order, like the file). */
export function serializeFragment(fragment: Fragment): string {
  const { external, enums, images, assets } = fragment;
  return JSON.stringify({
    sododeckFragment: 1,
    deck: canonicalize(fragment.deck),
    ...(images === undefined || images.length === 0
      ? {}
      : {
          images: images.map((image) => canonicalizeEntry('images', image)),
          assets: assets ?? {},
        }),
    ...(external === undefined
      ? {}
      : { external: external.map((e) => canonicalizeEntry('edges', e)) }),
    ...(enums === undefined ? {} : { enums: enums.map((e) => canonicalizeEntry('enums', e)) }),
  });
}

/**
 * The optional 055 keys: `images` checked one by one like any edit (so the same rules apply),
 * `assets` entries as pictures without bytes, every image naming one of them. Null when malformed.
 */
function parseImages(value: Record<string, unknown>): Pick<Fragment, 'images' | 'assets'> | null {
  const { images, assets } = value;
  if (images === undefined && assets === undefined) return {};
  if (!Array.isArray(images) || !isRecord(assets)) return null;
  const ids = new Set<string>();
  for (const image of images) {
    if (validateObject('images', image).length > 0 || !isRecord(image)) return null;
    if (typeof image.id !== 'string' || ids.has(image.id)) return null;
    ids.add(image.id);
    if (typeof image.asset !== 'string' || !isRecord(assets[image.asset])) return null;
  }
  for (const entry of Object.values(assets)) {
    if (!isRecord(entry) || validateObject('asset', { ...entry, data: 'AA==' }).length > 0) {
      return null;
    }
  }
  return { images: images as Image[], assets: assets as Record<Id, AssetMeta> };
}

/**
 * The optional 043 keys checked with the file parser (an edge or an enum is valid exactly as in a
 * deck), or null when either is malformed or reuses an id. Dangling `to` ids are expected here:
 * paste resolves them against the target deck.
 */
function parseExtras(value: Record<string, unknown>): Pick<Fragment, 'external' | 'enums'> | null {
  const { external, enums } = value;
  if (external === undefined && enums === undefined) return {};
  const parsed = parseSododeckFile({
    ...emptySododeckFile(),
    ...(external === undefined ? {} : { edges: external }),
    ...(enums === undefined ? {} : { enums }),
  });
  if (!parsed.success || checkDuplicateIds(parsed.data).length > 0) return null;
  return {
    ...(external === undefined ? {} : { external: parsed.data.edges }),
    ...(parsed.data.enums === undefined ? {} : { enums: parsed.data.enums }),
  };
}

/**
 * The fragment in clipboard `text`, or null for plain text, other JSON, an invalid deck or a
 * deck with duplicate ids (FR-007), or malformed `external` / `enums` (043).
 */
export function parseFragment(text: string): Fragment | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.sododeckFragment !== 1) return null;
  const parsed = parseSododeckFile(value.deck);
  if (!parsed.success || checkDuplicateIds(parsed.data).length > 0) return null;
  const extras = parseExtras(value);
  const pictures = parseImages(value);
  if (extras === null || pictures === null) return null;
  return { sododeckFragment: 1, deck: parsed.data, ...extras, ...pictures };
}

/** Top-left corner of the fragment's nodes, frames, images and notes (computed, never stored). */
export function fragmentOrigin(fragment: Fragment): Point {
  let x = Infinity;
  let y = Infinity;
  const take = (point: Point | undefined) => {
    if (point === undefined) return;
    x = Math.min(x, point.x);
    y = Math.min(y, point.y);
  };
  for (const node of fragment.deck.nodes) take(node.position);
  for (const group of fragment.deck.groups) take(frameOf(group)?.position);
  for (const image of fragment.images ?? []) take(image.position);
  for (const sticky of fragment.deck.stickies) take(sticky.position);
  return Number.isFinite(x) ? { x, y } : { x: 0, y: 0 };
}
