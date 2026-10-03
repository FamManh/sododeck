import type { SododeckFile } from '@sododeck/schema';

import type { MergedEdge, VisibleGraph } from './visible-graph';

/** Prefix of a bundle's React Flow id: `bundle:<a>|<b>` over the sorted visible ids (034). */
export const BUNDLE_EDGE_PREFIX = 'bundle:';

type DeckEdgeObject = SododeckFile['edges'][number];

export interface Bundle {
  id: string;
  a: string;
  b: string;
  /** Two or more, in deck order. */
  edgeIds: readonly string[];
  direction: MergedEdge['direction'];
  /** The user fanned it out: its connectors draw on their own, the pill stays. */
  fanned: boolean;
}

/** A connector drawn by itself; fan fields are set only for the members of a fanned bundle. */
export interface PlainEdge {
  edgeId: string;
  fanIndex?: number;
  fanCount?: number;
}

export interface BundleResult {
  plain: readonly PlainEdge[];
  bundles: readonly Bundle[];
}

export interface BundleOptions {
  /** Connectors that must draw on their own: the shown flow's marked ones. */
  exclude: ReadonlySet<string>;
  fanned: ReadonlySet<string>;
  /** Nothing bundles (recording a flow: every connector is a candidate step). */
  off: boolean;
}

interface Candidate {
  edge: DeckEdgeObject;
  from: string;
  to: string;
}

const cache = new WeakMap<VisibleGraph, Map<string, BundleResult>>();

/**
 * Only an automatic connector folds into a bundle (034): one with its own route, and later one
 * with waypoints, anchors or a style of its own (022), always draws on its own. Keep every such
 * rule here.
 */
function foldable(edge: DeckEdgeObject): boolean {
  return edge.route === undefined;
}

function directionOf(candidate: Candidate, a: string): MergedEdge['direction'] {
  const { edge } = candidate;
  if (edge.direction === 'both' || edge.direction === 'none') return 'both';
  return candidate.from === a ? 'a-to-b' : 'b-to-a';
}

function candidates(deck: SododeckFile, graph: VisibleGraph): Candidate[] {
  const byId = new Map(deck.edges.map((edge) => [edge.id, edge]));
  const out: Candidate[] = [];
  for (const edgeId of graph.edges) {
    const edge = byId.get(edgeId);
    if (edge === undefined) continue;
    out.push({
      edge,
      from: graph.representative.get(edge.from) ?? edge.from,
      to: graph.representative.get(edge.to) ?? edge.to,
    });
  }
  for (const port of graph.ports) {
    for (const edgeId of port.edgeIds) {
      const edge = byId.get(edgeId);
      if (edge === undefined) continue;
      const inside = port.insideNodeIds.find((id) => edge.from === id || edge.to === id);
      if (inside === undefined) continue;
      const rep = graph.representative.get(inside) ?? inside;
      out.push({
        edge,
        from: edge.from === inside ? rep : port.id,
        to: edge.to === inside ? rep : port.id,
      });
    }
  }
  return out;
}

/**
 * Groups parallel automatic connectors between the same two visible cards (034 R4). Derived,
 * never stored; cached per visible graph and option set so equal inputs return the same object.
 */
export function bundleEdges(
  deck: SododeckFile,
  graph: VisibleGraph,
  options: BundleOptions,
): BundleResult {
  const key = `${options.off ? '1' : '0'}|${[...options.exclude].sort().join(',')}|${[...options.fanned].sort().join(',')}`;
  let byKey = cache.get(graph);
  if (byKey === undefined) {
    byKey = new Map();
    cache.set(graph, byKey);
  }
  const cached = byKey.get(key);
  if (cached !== undefined) return cached;

  const all = candidates(deck, graph);
  const pairs = new Map<string, Candidate[]>();
  if (!options.off) {
    for (const candidate of all) {
      if (candidate.from === candidate.to) continue;
      if (!foldable(candidate.edge) || options.exclude.has(candidate.edge.id)) continue;
      const [a, b] =
        candidate.from < candidate.to
          ? [candidate.from, candidate.to]
          : [candidate.to, candidate.from];
      const pairKey = `${a}|${b}`;
      const list = pairs.get(pairKey);
      if (list === undefined) pairs.set(pairKey, [candidate]);
      else list.push(candidate);
    }
  }

  const bundles: Bundle[] = [];
  const slots = new Map<string, { index: number; count: number }>();
  const bundled = new Set<string>();
  for (const [pairKey, list] of pairs) {
    if (list.length < 2) continue;
    const [a = '', b = ''] = pairKey.split('|');
    const id = `${BUNDLE_EDGE_PREFIX}${pairKey}`;
    const fanned = options.fanned.has(id);
    let direction: MergedEdge['direction'] | undefined;
    list.forEach((candidate, index) => {
      const next = directionOf(candidate, a);
      direction = direction === undefined || direction === next ? next : 'both';
      if (fanned) slots.set(candidate.edge.id, { index, count: list.length });
      else bundled.add(candidate.edge.id);
    });
    bundles.push({
      id,
      a,
      b,
      edgeIds: list.map((candidate) => candidate.edge.id),
      direction: direction ?? 'both',
      fanned,
    });
  }

  const plain: PlainEdge[] = [];
  for (const { edge } of all) {
    if (bundled.has(edge.id)) continue;
    const slot = slots.get(edge.id);
    plain.push(
      slot === undefined
        ? { edgeId: edge.id }
        : { edgeId: edge.id, fanIndex: slot.index, fanCount: slot.count },
    );
  }

  const result: BundleResult = { plain, bundles };
  byKey.set(key, result);
  return result;
}

const NO_IDS: ReadonlySet<string> = new Set();

/**
 * Which connectors bundle right now (034 R5). A shown flow draws its marked connectors on their
 * own, so the rest of each pair re-bundles with a lower count; recording turns bundling off
 * because every connector must be clickable as a candidate step (006).
 */
export function bundleOptions(
  flow: { shown: boolean; recording: boolean; markedEdges: Iterable<string> },
  fanned: ReadonlySet<string>,
): BundleOptions {
  return {
    exclude: flow.shown && !flow.recording ? new Set(flow.markedEdges) : NO_IDS,
    fanned,
    off: flow.recording,
  };
}
