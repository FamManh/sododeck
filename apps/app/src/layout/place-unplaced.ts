/**
 * Placing the cards of an imported file that have no position (027 FR-024; Mermaid import, 056).
 * A file may leave positions out (the AI deck skill always does); before such a deck is stored,
 * every unplaced card gets one from the auto-layout, and every placed card stays exactly where it
 * is (it is pinned, so `applyPins` moves the free cards off it). Each level (cards sharing a
 * `parent`) is its own screen, so each is laid out on its own.
 *
 * - Cards are measured the way the canvas draws them (`cardSize`: wrapped titles, tech line,
 *   fields), so laid-out cards never overlap once drawn.
 * - A note anchored to an unplaced card, with no offset of its own, gets a slot right under its
 *   card: the card's layout box grows by the note, and the note's offset points into that slot.
 * - A saved view other than the first that shows only some cards (its `includes`, its feature's
 *   flows, …) and has no positions of its own is laid out on its own too, so a feature view opens
 *   as a compact diagram instead of its cards scattered at their base positions.
 *
 * Main thread; the layout itself runs in the layout worker.
 */
import {
  fitGroupFrames,
  STICKY_COLLAPSED_HEIGHT,
  STICKY_DEFAULT_SIZE,
  type Point,
} from '@sododeck/model';
import type { Frame, Id, Node, Size, SododeckFile, Sticky, View } from '@sododeck/schema';

import { cardFieldView } from '../editor/card-fields';
import { cardSize, GROUP_PADDING } from '../editor/canvas-geometry';
import { tableContextOf } from '../editor/table-keys';
import { viewFilter } from '../editor/view-filter';
import type { LayoutRequest, LayoutResult } from './elk-layout';

/** Gap between a card and the note placed under it, and between stacked notes. */
export const NOTE_GAP = 16;

export function hasUnplacedCards(file: Pick<SododeckFile, 'nodes'>): boolean {
  return file.nodes.some((node) => node.position === undefined);
}

const noteSize = (sticky: Sticky): Size => {
  const size = sticky.size ?? STICKY_DEFAULT_SIZE;
  return sticky.collapsed === true ? { width: size.width, height: STICKY_COLLAPSED_HEIGHT } : size;
};

interface Measures {
  /** The card as the canvas draws it. */
  card(node: Node): Size;
  /** The card plus the notes placed under it: what the layout must keep free. */
  box(node: Node): Size;
  /** Notes that get a slot under `nodeId`, in file order. */
  notesUnder(nodeId: Id): readonly Sticky[];
}

function measuresOf(file: SododeckFile): Measures {
  const table = tableContextOf(file);
  const children = new Map<Id, number>();
  for (const node of file.nodes) {
    if (node.parent !== undefined) children.set(node.parent, (children.get(node.parent) ?? 0) + 1);
  }
  const unplaced = new Set(file.nodes.filter((n) => n.position === undefined).map((n) => n.id));
  const notes = new Map<Id, Sticky[]>();
  for (const sticky of file.stickies) {
    // Only notes riding on a card this placement moves, and only when no offset was chosen.
    if (sticky.anchor === undefined || sticky.position !== undefined) continue;
    if (!unplaced.has(sticky.anchor)) continue;
    notes.set(sticky.anchor, [...(notes.get(sticky.anchor) ?? []), sticky]);
  }
  const card = (node: Node): Size =>
    cardSize(node, undefined, {
      table,
      fields: cardFieldView(file, node),
      childCount: children.get(node.id),
    });
  return {
    card,
    box(node) {
      const size = card(node);
      let { width, height } = size;
      for (const sticky of notes.get(node.id) ?? []) {
        const note = noteSize(sticky);
        width = Math.max(width, note.width);
        height += NOTE_GAP + note.height;
      }
      return { width, height };
    },
    notesUnder: (nodeId) => notes.get(nodeId) ?? [],
  };
}

/** Cards by level: the `parent` id, `''` for the top level. In file order. */
function levelsOf(cards: readonly Node[]): Node[][] {
  const levels = new Map<string, Node[]>();
  for (const node of cards) {
    const key = node.parent ?? '';
    levels.set(key, [...(levels.get(key) ?? []), node]);
  }
  return [...levels.values()];
}

/** The layout request for some cards of one level: groups as compounds, `pin`ned cards fixed. */
function cardsRequest(
  file: SododeckFile,
  cards: readonly Node[],
  measures: Measures,
  pin: boolean,
  direction: LayoutRequest['direction'],
): LayoutRequest {
  const cardIds = new Set(cards.map((node) => node.id));
  const groupParents = new Map(file.groups.map((g) => [g.id, g.parent]));
  // The groups these cards sit in, with their ancestors, so nesting survives.
  const used = new Set<Id>();
  for (const node of cards) {
    let group = node.group;
    while (group !== undefined && groupParents.has(group) && !used.has(group)) {
      used.add(group);
      group = groupParents.get(group);
    }
  }
  // A connector end may be a group frame: the layout names it `group:<id>`. Ends that are notes,
  // images or cards outside the request are left out; the layout knows these cards only.
  const end = (id: Id) => (cardIds.has(id) ? id : used.has(id) ? `group:${id}` : undefined);
  const edges: LayoutRequest['edges'] = [];
  for (const edge of file.edges) {
    const source = end(edge.from);
    const target = end(edge.to);
    if (source !== undefined && target !== undefined) edges.push({ id: edge.id, source, target });
  }
  const pinned: LayoutRequest['pinned'] = {};
  if (pin)
    for (const node of cards) if (node.position !== undefined) pinned[node.id] = node.position;
  return {
    nodes: cards.map((node) => ({
      id: node.id,
      ...measures.box(node),
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
  const measures = measuresOf(file);
  return levelsOf(file.nodes)
    .filter((cards) => cards.some((node) => node.position === undefined))
    .map((cards) => cardsRequest(file, cards, measures, true, direction));
}

/** Frames around the groups of `nodes` (at their given positions), sized to their layout boxes. */
function framesFor(file: SododeckFile, nodes: readonly Node[], measures: Measures): Map<Id, Frame> {
  const byId = new Map(file.nodes.map((n) => [n.id, n]));
  return fitGroupFrames(
    {
      nodes: [...nodes],
      groups: file.groups.map(({ position: _p, size: _s, ...g }) => g),
      views: [],
    },
    {
      cardSize: STICKY_DEFAULT_SIZE,
      sizeOf: (node) => measures.box(byId.get(node.id) ?? node),
      padding: GROUP_PADDING,
    },
  );
}

/**
 * Writes the layout's positions into the unplaced cards (placed ones keep theirs), gives each
 * slotted note its offset under its card, and fits a frame around every group that has none.
 * `result` holds the merged results of every level.
 */
export function applyPlacement(file: SododeckFile, result: LayoutResult): SododeckFile {
  const measures = measuresOf(file);
  const nodes = file.nodes.map((node, index) =>
    node.position !== undefined
      ? node
      : {
          ...node,
          // A card the layout missed (it should not happen) still gets a distinct grid cell.
          position: result[node.id] ?? { x: (index % 6) * 260, y: Math.floor(index / 6) * 160 },
        },
  );
  const offsets = new Map<Id, Point>();
  for (const node of file.nodes) {
    let y = measures.card(node).height;
    for (const sticky of measures.notesUnder(node.id)) {
      offsets.set(sticky.id, { x: 0, y: y + NOTE_GAP });
      y += NOTE_GAP + noteSize(sticky).height;
    }
  }
  const frames = framesFor(file, nodes, measures);
  return {
    ...file,
    nodes,
    groups: file.groups.map((group) => {
      if (group.position !== undefined && group.size !== undefined) return group;
      const frame = frames.get(group.id);
      return frame === undefined ? group : { ...group, position: frame.position, size: frame.size };
    }),
    stickies: file.stickies.map((sticky) => {
      const offset = offsets.get(sticky.id);
      return offset === undefined ? sticky : { ...sticky, position: offset };
    }),
  };
}

/**
 * Views laid out on their own: not the first (base) view, no positions yet, and showing fewer
 * cards than the whole deck. The cards are exactly the ones the canvas shows in that view
 * (`viewFilter`: `includes`, the feature's flows, hidden groups, kinds and tags).
 */
function viewsToPlace(file: SododeckFile): { view: View; cards: Node[] }[] {
  const none = new Set<Id>();
  return file.views.slice(1).flatMap((view) => {
    if (view.positions !== undefined) return [];
    const { hidden } = viewFilter(file, view, none);
    if (hidden.size === 0) return [];
    const cards = file.nodes.filter((node) => !hidden.has(node.id));
    return cards.length === 0 ? [] : [{ view, cards }];
  });
}

/** Per view to place, one layout request per level of the cards it shows. */
export function viewPlacementRequests(
  file: SododeckFile,
  direction?: LayoutRequest['direction'],
): { viewId: Id; requests: LayoutRequest[] }[] {
  const measures = measuresOf(file);
  return viewsToPlace(file).map(({ view, cards }) => ({
    viewId: view.id,
    requests: levelsOf(cards).map((level) => cardsRequest(file, level, measures, false, direction)),
  }));
}

/** Writes each placed view's positions and the frames of the groups its cards sit in. */
export function applyViewPlacement(
  file: SododeckFile,
  results: ReadonlyMap<Id, LayoutResult>,
  measuresFile: SododeckFile = file,
): SododeckFile {
  const measures = measuresOf(measuresFile);
  return {
    ...file,
    views: file.views.map((view) => {
      const result = results.get(view.id);
      if (result === undefined) return view;
      const positions: Record<Id, Point> = {};
      for (const node of file.nodes) {
        const at = result[node.id];
        if (at !== undefined) positions[node.id] = at;
      }
      const placed = file.nodes
        .filter((node) => positions[node.id] !== undefined)
        .map((node) => ({ ...node, position: positions[node.id] }));
      const frames = framesFor(file, placed, measures);
      return {
        ...view,
        positions,
        ...(frames.size === 0 ? {} : { groupFrames: Object.fromEntries(frames) }),
      };
    }),
  };
}

/**
 * Places every unplaced card of `file` with `layout` (one call per level, in order), then lays
 * out each feature view that lists its cards.
 */
export async function placeUnplaced(
  file: SododeckFile,
  layout: (request: LayoutRequest) => Promise<LayoutResult>,
  direction?: LayoutRequest['direction'],
): Promise<SododeckFile> {
  const merged: LayoutResult = {};
  for (const request of placementRequests(file, direction)) {
    Object.assign(merged, await layout(request));
  }
  const placed = applyPlacement(file, merged);
  const views = new Map<Id, LayoutResult>();
  for (const { viewId, requests } of viewPlacementRequests(file, direction)) {
    const result: LayoutResult = {};
    for (const request of requests) Object.assign(result, await layout(request));
    views.set(viewId, result);
  }
  // Measured on the input file: its notes are the ones that got a slot under their cards.
  return views.size === 0 ? placed : applyViewPlacement(placed, views, file);
}
