/**
 * Clipboard fragments (016 research R9, ADR 0017): the copied nodes, edges and groups as a valid
 * `.sododeck.json` file inside a small envelope, `{ "sododeckFragment": 1, "deck": … }`. Built and
 * parsed here so the app never converts deck data itself (constitution II), and validated with
 * the file parser, so a fragment is valid by construction and plain text is ignored.
 */
import {
  emptySododeckFile,
  parseSododeckFile,
  type Edge,
  type Group,
  type Id,
  type Node,
  type SododeckFile,
} from '@sododeck/schema';

import { frameOf, NODE_GRID, viewNodePosition, type Point } from './geometry';
import { canonicalize } from './key-order';
import { checkDuplicateIds } from './load-checks';

export interface Fragment {
  sododeckFragment: 1;
  /** Only nodes, edges and groups; every other collection is empty. */
  deck: SododeckFile;
}

export interface FragmentSelection {
  nodes: readonly Id[];
  groups: readonly Id[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The fragment of `selection` in `file` (R10): the selected nodes, the edges with both ends
 * selected, and the selected groups whose whole subtree (members and nested groups) is selected,
 * with their frames. References that leave the fragment (`group`, `parent`) are dropped; rule ids
 * stay and are resolved on paste. Positions and frames are the ones `viewId` draws (the base
 * view's when absent); a node without a position gets its grid slot.
 */
export function toFragment(
  file: SododeckFile,
  selection: FragmentSelection,
  viewId?: Id,
): Fragment {
  const view = viewId === undefined ? undefined : file.views.find((v) => v.id === viewId);
  const nodeIds = new Set(selection.nodes);
  const named = new Set(selection.groups);

  const members = new Map<Id, Id[]>();
  for (const node of file.nodes) {
    if (node.group === undefined) continue;
    members.set(node.group, [...(members.get(node.group) ?? []), node.id]);
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
      (members.get(id) ?? []).every((n) => nodeIds.has(n)) &&
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
  const edges: Edge[] = file.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));

  return {
    sododeckFragment: 1,
    deck: canonicalize({ ...emptySododeckFile(), name: 'Fragment', nodes, groups, edges }),
  };
}

/** The clipboard text of a fragment (canonical key order, like the file). */
export function serializeFragment(fragment: Fragment): string {
  return JSON.stringify({ sododeckFragment: 1, deck: canonicalize(fragment.deck) });
}

/**
 * The fragment in clipboard `text`, or null for plain text, other JSON, an invalid deck or a
 * deck with duplicate ids (FR-007).
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
  return { sododeckFragment: 1, deck: parsed.data };
}

/** Top-left corner of the fragment's nodes and frames (computed, never stored). */
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
  return Number.isFinite(x) ? { x, y } : { x: 0, y: 0 };
}
