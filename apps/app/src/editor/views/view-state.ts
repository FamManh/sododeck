/**
 * The current view as the canvas uses it (011, ADR 0012 §6). Pure and memoized per snapshot:
 *
 * - `deck` is the deck projected through the view: components at their view position (the view's
 *   own, else the base one), groups with the view's own frames (016), hidden components left out (others keep their grid slot), notes on
 *   hidden components left out. Every geometry helper (`visibleGraph`, `groupBounds`, sticky
 *   placement, fit) reads it unchanged. A view with no own positions and nothing hidden returns
 *   the snapshot itself, so the base view costs exactly what it did before views existed.
 * - `render` carries what `deck-to-flow` draws per component: subtitle, dimming, pins, notes.
 *
 * Never written anywhere: the document stays the snapshot; writes go through the editor ops.
 */
import { NODE_GRID, resolveViews, viewNodePosition } from '@sododeck/model';
import type { Group, Id, Node, SododeckFile, SubtitleField, View } from '@sododeck/schema';

import { setCardFieldDeck } from '../card-fields';
import { flowCountByNode, viewFilter } from '../view-filter';

export interface ViewRender {
  subtitleField: SubtitleField;
  flowCounts: ReadonlyMap<Id, number>;
  dimmed: ReadonlySet<Id>;
  pinned: ReadonlySet<Id>;
  /** Revealed components this view would otherwise hide: they carry "Hidden in this view". */
  revealedHidden: ReadonlySet<Id>;
}

export interface ViewState {
  views: readonly View[];
  view: View;
  /** The first view: it edits base positions (FR-020). */
  isBase: boolean;
  /** The deck as this view draws it (see the module comment). */
  deck: SododeckFile;
  hidden: ReadonlySet<Id>;
  collapsed: ReadonlySet<Id>;
  render: ViewRender;
}

const EMPTY: ReadonlySet<Id> = new Set();
const NO_POSITIONS: NonNullable<View['positions']> = {};
const NO_FRAMES: NonNullable<View['groupFrames']> = {};

/** Subtitle text of a component in a view (FR-010, FR-011). */
export function subtitleOf(
  node: Pick<Node, 'id' | 'tech' | 'host' | 'owner'>,
  render: Pick<ViewRender, 'subtitleField' | 'flowCounts'>,
): string | undefined {
  switch (render.subtitleField) {
    case 'tech':
      return node.tech;
    case 'host':
      return node.host;
    case 'owner':
      return node.owner;
    case 'none':
      return undefined;
    case 'flows': {
      const n = render.flowCounts.get(node.id) ?? 0;
      const flows = `${String(n)} ${n === 1 ? 'flow' : 'flows'}`;
      const owner = node.owner?.trim();
      return owner === undefined || owner === '' ? flows : `${flows} · ${owner}`;
    }
  }
}

/** Sets derived from id lists, by list identity (snapshot lists keep it while unchanged). */
const listSets = new WeakMap<readonly Id[], ReadonlySet<Id>>();
function setOf(list: readonly Id[] | undefined): ReadonlySet<Id> {
  if (list === undefined || list.length === 0) return EMPTY;
  let set = listSets.get(list);
  if (set === undefined) {
    set = new Set(list);
    listSets.set(list, set);
  }
  return set;
}

const projectedNodes = new WeakMap<Node, { x: number; y: number; node: Node }>();
function placed(node: Node, x: number, y: number): Node {
  if (node.position?.x === x && node.position.y === y) return node;
  const cached = projectedNodes.get(node);
  if (cached?.x === x && cached.y === y) return cached.node;
  const next = { ...node, position: { x, y } };
  projectedNodes.set(node, { x, y, node: next });
  return next;
}

const nodeLists = new WeakMap<
  readonly Node[],
  WeakMap<NonNullable<View['positions']>, WeakMap<ReadonlySet<Id>, Node[]>>
>();

function projectNodes(
  nodes: Node[],
  positions: NonNullable<View['positions']>,
  hidden: ReadonlySet<Id>,
): Node[] {
  if (hidden.size === 0 && positions === NO_POSITIONS) return nodes;
  let byPositions = nodeLists.get(nodes);
  if (byPositions === undefined) {
    byPositions = new WeakMap();
    nodeLists.set(nodes, byPositions);
  }
  let byHidden = byPositions.get(positions);
  if (byHidden === undefined) {
    byHidden = new WeakMap();
    byPositions.set(positions, byHidden);
  }
  const cached = byHidden.get(hidden);
  if (cached !== undefined) return cached;
  const out: Node[] = [];
  nodes.forEach((node, index) => {
    if (hidden.has(node.id)) return;
    const own = viewNodePosition({ positions }, node);
    if (own !== undefined) {
      out.push(placed(node, own.x, own.y));
    } else if (hidden.size > 0) {
      // Leaving components out shifts indices: pin the grid slot of the full list.
      out.push(
        placed(
          node,
          (index % NODE_GRID.columns) * NODE_GRID.dx,
          Math.floor(index / NODE_GRID.columns) * NODE_GRID.dy,
        ),
      );
    } else {
      out.push(node);
    }
  });
  byHidden.set(hidden, out);
  return out;
}

const stickyLists = new WeakMap<
  SododeckFile['stickies'],
  WeakMap<ReadonlySet<Id>, SododeckFile['stickies']>
>();
function projectStickies(
  stickies: SododeckFile['stickies'],
  hidden: ReadonlySet<Id>,
): SododeckFile['stickies'] {
  if (hidden.size === 0) return stickies;
  let byHidden = stickyLists.get(stickies);
  if (byHidden === undefined) {
    byHidden = new WeakMap();
    stickyLists.set(stickies, byHidden);
  }
  const cached = byHidden.get(hidden);
  if (cached !== undefined) return cached;
  const out = stickies.filter((s) => s.anchor === undefined || !hidden.has(s.anchor));
  byHidden.set(hidden, out);
  return out;
}

const groupLists = new WeakMap<
  readonly Group[],
  WeakMap<NonNullable<View['groupFrames']>, Group[]>
>();

/** Groups with the view's own frames in place of their base frames (016, R4). */
function projectGroups(
  groups: readonly Group[],
  frames: NonNullable<View['groupFrames']>,
): Group[] {
  let byFrames = groupLists.get(groups);
  if (byFrames === undefined) {
    byFrames = new WeakMap();
    groupLists.set(groups, byFrames);
  }
  const cached = byFrames.get(frames);
  if (cached !== undefined) return cached;
  const out = groups.map((group) => {
    const own = frames[group.id];
    return own === undefined ? group : { ...group, position: own.position, size: own.size };
  });
  byFrames.set(frames, out);
  return out;
}

const shownGroupLists = new WeakMap<readonly Group[], WeakMap<readonly Node[], Group[]>>();

/**
 * Groups minus those whose members the view hides all of (031): an empty group shows as an empty
 * frame (`visibleGraph`), so a group emptied only by this view's filters must leave the view's
 * deck, as it did before empty groups were drawn. Groups that were empty to begin with stay.
 */
function withoutHiddenGroups(
  groups: readonly Group[],
  allNodes: readonly Node[],
  shownNodes: readonly Node[],
): Group[] {
  let byNodes = shownGroupLists.get(groups);
  if (byNodes === undefined) {
    byNodes = new WeakMap();
    shownGroupLists.set(groups, byNodes);
  }
  const cached = byNodes.get(shownNodes);
  if (cached !== undefined) return cached;
  const parents = new Map(groups.map((group) => [group.id, group.parent]));
  const filledBy = (nodes: readonly Node[]) => {
    const out = new Set<Id>();
    for (const node of nodes) {
      let current = node.group;
      while (current !== undefined && !out.has(current) && parents.has(current)) {
        out.add(current);
        current = parents.get(current);
      }
    }
    return out;
  };
  const filled = filledBy(allNodes);
  const shown = filledBy(shownNodes);
  const out = groups.filter((group) => !filled.has(group.id) || shown.has(group.id));
  byNodes.set(shownNodes, out);
  return out;
}

const projectedDecks = new WeakMap<
  SododeckFile,
  {
    nodes: Node[];
    groups: SododeckFile['groups'];
    stickies: SododeckFile['stickies'];
    deck: SododeckFile;
  }
>();

/**
 * The deck as `view` draws it. Returns `deck` itself when the view changes nothing. Like
 * positions, a view's own group frames win in any view (a view that became the base keeps them).
 */
export function viewDeck(deck: SododeckFile, view: View, hidden: ReadonlySet<Id>): SododeckFile {
  const positions = view.positions ?? NO_POSITIONS;
  const frames = view.groupFrames ?? NO_FRAMES;
  const noFrames = Object.keys(frames).length === 0;
  if (hidden.size === 0 && Object.keys(positions).length === 0 && noFrames) return deck;
  const nodes = projectNodes(deck.nodes, positions, hidden);
  const framed = noFrames ? deck.groups : projectGroups(deck.groups, frames);
  const groups = hidden.size === 0 ? framed : withoutHiddenGroups(framed, deck.nodes, nodes);
  const stickies = projectStickies(deck.stickies, hidden);
  const cached = projectedDecks.get(deck);
  if (cached?.nodes === nodes && cached.groups === groups && cached.stickies === stickies) {
    return cached.deck;
  }
  const projected = { ...deck, nodes, groups, stickies };
  projectedDecks.set(deck, { nodes, groups, stickies, deck: projected });
  return projected;
}

const states = new WeakMap<
  SododeckFile,
  Map<Id | null, { revealed: ReadonlySet<Id>; state: ViewState }>
>();

/** The view `currentViewId` (the first one when null or gone) of `file`, as the canvas uses it. */
export function viewStateOf(
  file: SododeckFile,
  currentViewId: Id | null,
  revealed: ReadonlySet<Id> = EMPTY,
): ViewState {
  // Card heights follow the typed fields this deck shows (032); every geometry helper reads them.
  setCardFieldDeck(file);
  let byView = states.get(file);
  const cached = byView?.get(currentViewId);
  if (cached?.revealed === revealed) return cached.state;

  const views = resolveViews(file);
  const view = views.find((v) => v.id === currentViewId) ?? views[0];
  // `resolveViews` falls back to the presets, so there is always a first view.
  if (view === undefined) throw new Error('A deck always has at least one view.');
  const { hidden, dimmed } = viewFilter(file, view, revealed);
  const revealedHidden =
    revealed.size === 0
      ? EMPTY
      : new Set([...revealed].filter((id) => viewFilter(file, view, EMPTY).hidden.has(id)));
  const state: ViewState = {
    views,
    view,
    isBase: view === views[0],
    deck: viewDeck(file, view, hidden),
    hidden,
    collapsed: setOf(view.collapsed),
    render: {
      subtitleField: view.subtitleField ?? 'tech',
      flowCounts: view.subtitleField === 'flows' ? flowCountByNode(file) : EMPTY_COUNTS,
      dimmed,
      pinned: setOf(view.pinned),
      revealedHidden,
    },
  };
  if (byView === undefined) {
    byView = new Map();
    states.set(file, byView);
  }
  byView.set(currentViewId, { revealed, state });
  return state;
}

const EMPTY_COUNTS: ReadonlyMap<Id, number> = new Map();
