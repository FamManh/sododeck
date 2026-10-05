/**
 * Placing the cards of an imported file that have no position (027 FR-024; Mermaid import, 056).
 * A file may leave positions out (the AI deck skill always does); before such a deck is stored,
 * every unplaced card gets one from the auto-layout, and every placed card stays exactly where it
 * is (it is pinned, so `applyPins` moves the free cards off it). Each level (cards sharing a
 * `parent`) is its own screen, so each is laid out on its own. Main thread; the layout itself
 * runs in the layout worker.
 */
import { fitGroupFrames } from '@sododeck/model';
import type { Id, Node, SododeckFile } from '@sododeck/schema';

import { GROUP_PADDING } from '../editor/canvas-geometry';
import { defaultSize } from '../import-mermaid/shape-map';
import type { LayoutRequest, LayoutResult } from './elk-layout';

const sizeOf = (node: Node) => node.size ?? defaultSize(node.type);

export function hasUnplacedCards(file: Pick<SododeckFile, 'nodes'>): boolean {
  return file.nodes.some((node) => node.position === undefined);
}

/** Cards by level: the `parent` id, `''` for the top level. In file order. */
function levelsOf(file: SododeckFile): Map<string, Node[]> {
  const levels = new Map<string, Node[]>();
  for (const node of file.nodes) {
    const key = node.parent ?? '';
    const list = levels.get(key) ?? [];
    list.push(node);
    levels.set(key, list);
  }
  return levels;
}

/** The layout request for one level's cards: groups as compounds, placed cards pinned. */
function levelRequest(
  file: SododeckFile,
  cards: readonly Node[],
  direction: LayoutRequest['direction'],
): LayoutRequest {
  const cardIds = new Set(cards.map((node) => node.id));
  const groupParents = new Map(file.groups.map((g) => [g.id, g.parent]));
  // The groups this level's cards sit in, with their ancestors, so nesting survives.
  const used = new Set<Id>();
  for (const node of cards) {
    let group = node.group;
    while (group !== undefined && groupParents.has(group) && !used.has(group)) {
      used.add(group);
      group = groupParents.get(group);
    }
  }
  // A connector end may be a group frame: the layout names it `group:<id>`. Ends that are notes,
  // images or cards of another level are left out; the layout knows this level's cards only.
  const end = (id: Id) => (cardIds.has(id) ? id : used.has(id) ? `group:${id}` : undefined);
  const edges: LayoutRequest['edges'] = [];
  for (const edge of file.edges) {
    const source = end(edge.from);
    const target = end(edge.to);
    if (source !== undefined && target !== undefined) edges.push({ id: edge.id, source, target });
  }
  const pinned: LayoutRequest['pinned'] = {};
  for (const node of cards) if (node.position !== undefined) pinned[node.id] = node.position;
  return {
    nodes: cards.map((node) => ({
      id: node.id,
      ...sizeOf(node),
      ...(node.group !== undefined && used.has(node.group) ? { parent: node.group } : {}),
    })),
    groups: file.groups
      .filter((g) => used.has(g.id))
      .map((g) =>
        g.parent !== undefined && used.has(g.parent)
          ? { id: g.id, parent: g.parent }
          : { id: g.id },
      ),
    edges,
    pinned,
    ...(direction === undefined ? {} : { direction }),
  };
}

/** One layout request per level that has at least one unplaced card. */
export function placementRequests(
  file: SododeckFile,
  direction?: LayoutRequest['direction'],
): LayoutRequest[] {
  return [...levelsOf(file).values()]
    .filter((cards) => cards.some((node) => node.position === undefined))
    .map((cards) => levelRequest(file, cards, direction));
}

/**
 * Writes the layout's positions into the unplaced cards (placed ones keep theirs) and fits a frame
 * around every group that has none. `result` holds the merged results of every level.
 */
export function applyPlacement(file: SododeckFile, result: LayoutResult): SododeckFile {
  const nodes = file.nodes.map((node, index) =>
    node.position !== undefined
      ? node
      : {
          ...node,
          // A card the layout missed (it should not happen) still gets a distinct grid cell.
          position: result[node.id] ?? { x: (index % 6) * 260, y: Math.floor(index / 6) * 160 },
        },
  );
  const frames = fitGroupFrames(
    { nodes, groups: file.groups, views: [] },
    { cardSize: defaultSize('rectangle'), sizeOf, padding: GROUP_PADDING },
  );
  return {
    ...file,
    nodes,
    groups: file.groups.map((group) => {
      const frame = frames.get(group.id);
      return frame === undefined ? group : { ...group, position: frame.position, size: frame.size };
    }),
  };
}

/** Places every unplaced card of `file` with `layout` (one call per level, in order). */
export async function placeUnplaced(
  file: SododeckFile,
  layout: (request: LayoutRequest) => Promise<LayoutResult>,
  direction?: LayoutRequest['direction'],
): Promise<SododeckFile> {
  const merged: LayoutResult = {};
  for (const request of placementRequests(file, direction)) {
    Object.assign(merged, await layout(request));
  }
  return applyPlacement(file, merged);
}
