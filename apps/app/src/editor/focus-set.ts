import type { SododeckFile } from '@sododeck/schema';

import type { Bundle, BundleResult } from './bundles';
import type { VisibleGraph } from './visible-graph';

type DeckEdge = SododeckFile['edges'][number];

export interface FocusSet {
  focusId: string;
  members: ReadonlySet<string>;
  edges: ReadonlySet<string>;
}

export function focusSet(
  deck: SododeckFile,
  graph: VisibleGraph,
  id: string,
  bundles?: BundleResult,
): FocusSet | null {
  const visible = new Set<string>([
    ...graph.nodes,
    ...graph.cards.map((card) => `collapsed:${card.groupId}`),
  ]);
  if (!visible.has(id)) return null;

  const members = new Set<string>([id]);
  const edges = new Set<string>();
  const edgesById = edgeLookup(deck);

  // A folded bundle counts as one connection; a fanned one lights its own connectors and keeps
  // its pill lit, so the pill never dims while its connectors are bright.
  const bundleOf = new Map<string, Bundle>();
  for (const bundle of bundles?.bundles ?? []) {
    for (const edgeId of bundle.edgeIds) bundleOf.set(edgeId, bundle);
  }
  const touch = (edgeId: string, other: string) => {
    members.add(other);
    const bundle = bundleOf.get(edgeId);
    if (bundle?.fanned === false) edges.add(bundle.id);
    else {
      edges.add(edgeId);
      if (bundle !== undefined) edges.add(bundle.id);
    }
  };

  for (const edgeId of graph.edges) {
    const edge = edgesById.get(edgeId);
    if (edge === undefined) continue;
    const from = graph.representative.get(edge.from) ?? edge.from;
    const to = graph.representative.get(edge.to) ?? edge.to;
    if (from === id || to === id) touch(edgeId, from === id ? to : from);
  }

  // Drill-in: connections to cards outside the scope end on a proxy, which is a neighbour too.
  for (const port of graph.ports) {
    for (const edgeId of port.edgeIds) {
      const edge = edgesById.get(edgeId);
      if (edge === undefined) continue;
      const inside = port.insideNodeIds.find(
        (nodeId) => edge.from === nodeId || edge.to === nodeId,
      );
      if (inside === undefined) continue;
      if ((graph.representative.get(inside) ?? inside) === id) touch(edgeId, port.id);
    }
  }

  for (const merged of graph.merged) {
    if (merged.a === id || merged.b === id) {
      members.add(merged.a === id ? merged.b : merged.a);
      edges.add(merged.id);
    }
  }

  return { focusId: id, members, edges };
}

const edgeLookups = new WeakMap<SododeckFile['edges'], ReadonlyMap<string, DeckEdge>>();

/** Edges by id, cached on the edges array: a hover must not scan the list once per connector. */
function edgeLookup(deck: SododeckFile): ReadonlyMap<string, DeckEdge> {
  let lookup = edgeLookups.get(deck.edges);
  if (lookup === undefined) {
    lookup = new Map(deck.edges.map((edge) => [edge.id, edge]));
    edgeLookups.set(deck.edges, lookup);
  }
  return lookup;
}

/** What a keyboard focus announces: "<title>: 3 connections" (034 US1.4). */
export function connectionsText(title: string, count: number): string {
  return `${title}: ${String(count)} ${count === 1 ? 'connection' : 'connections'}`;
}

/** Deck connections behind a focus set: a merged connector counts every connector it folds. */
export function connectionCount(
  set: FocusSet,
  graph: VisibleGraph,
  bundles?: BundleResult,
): number {
  const folded = new Map(graph.merged.map((edge) => [edge.id, edge.edgeIds.length]));
  for (const bundle of bundles?.bundles ?? []) {
    if (!bundle.fanned) folded.set(bundle.id, bundle.edgeIds.length);
  }
  let count = 0;
  for (const id of set.edges) count += folded.get(id) ?? 1;
  return count;
}
