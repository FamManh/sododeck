import type { SododeckFile } from '@sododeck/schema';

import type { VisibleGraph } from './visible-graph';

export interface FocusSet {
  focusId: string;
  members: ReadonlySet<string>;
  edges: ReadonlySet<string>;
}

export function focusSet(deck: SododeckFile, graph: VisibleGraph, id: string): FocusSet | null {
  const visible = new Set<string>([
    ...graph.nodes,
    ...graph.cards.map((card) => `collapsed:${card.groupId}`),
  ]);
  if (!visible.has(id)) return null;

  const members = new Set<string>([id]);
  const edges = new Set<string>();

  for (const edgeId of graph.edges) {
    const edge = deck.edges.find((entry) => entry.id === edgeId);
    if (edge === undefined) continue;
    const from = graph.representative.get(edge.from) ?? edge.from;
    const to = graph.representative.get(edge.to) ?? edge.to;
    if (from === id || to === id) {
      members.add(from === id ? to : from);
      edges.add(edgeId);
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

/** What a keyboard focus announces: "<title>: 3 connections" (034 US1.4). */
export function connectionsText(title: string, count: number): string {
  return `${title}: ${String(count)} ${count === 1 ? 'connection' : 'connections'}`;
}

/** Deck connections behind a focus set: a merged connector counts every connector it folds. */
export function connectionCount(set: FocusSet, graph: VisibleGraph): number {
  const folded = new Map(graph.merged.map((edge) => [edge.id, edge.edgeIds.length]));
  let count = 0;
  for (const id of set.edges) count += folded.get(id) ?? 1;
  return count;
}
