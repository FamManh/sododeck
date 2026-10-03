/**
 * Derived displays of the inspectors (008 data-model §2): suggestions, usage, counts and the bulk
 * view. Pure functions of the snapshot; nothing here is stored (FR-035).
 */
import { analyzeFlow, ruleUsage, tagKey } from '@sododeck/model';
import type { ColorRef, Group, Id, Node, SododeckFile } from '@sododeck/schema';

import { tagSpellings } from '../tags/deck-tags';

const byName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' }) || a.localeCompare(b);

function distinct(values: Iterable<string | undefined>): string[] {
  const set = new Set<string>();
  for (const value of values) if (value !== undefined && value !== '') set.add(value);
  return [...set].sort(byName);
}

const allSteps = (deck: SododeckFile) => deck.flows.flatMap((f) => f.steps);

/** Owners already used in the deck (§g-10: suggestions come only from the deck). */
export function ownerSuggestions(deck: SododeckFile): string[] {
  return distinct(
    [...deck.nodes, ...deck.edges, ...deck.features, ...deck.flows, ...allSteps(deck)].map(
      (o) => o.owner,
    ),
  );
}

/** Tags already used on the deck, its components, connections, flows and steps: one per key (033). */
export function tagSuggestions(deck: SododeckFile): string[] {
  return [...tagSpellings(deck).values()].sort(byName);
}

export interface NodeConnection {
  edgeId: Id;
  direction: 'out' | 'in';
  otherId: Id;
  label: string | undefined;
}

/** Connections of a component in deck order; a self-connection counts as outgoing. */
export function nodeConnections(deck: SododeckFile, nodeId: Id): NodeConnection[] {
  return deck.edges.flatMap((e): NodeConnection[] => {
    if (e.from === nodeId)
      return [{ edgeId: e.id, direction: 'out', otherId: e.to, label: e.label }];
    if (e.to === nodeId)
      return [{ edgeId: e.id, direction: 'in', otherId: e.from, label: e.label }];
    return [];
  });
}

export interface EdgeUse {
  flowId: Id;
  flowTitle: string;
  stepId: Id;
  number: string;
}

/** Steps that run over a connection ("<flow> · Step n"), in flow and path order. */
export function edgeUsage(deck: SododeckFile, edgeId: Id): EdgeUse[] {
  return deck.flows.flatMap((flow) => {
    if (!flow.steps.some((s) => s.edge === edgeId)) return [];
    const analysis = analyzeFlow(flow, deck.edges);
    return [analysis.main, ...analysis.branches.map((b) => b.steps)]
      .flat()
      .filter((p) => p.step.edge === edgeId)
      .map((p) => ({
        flowId: flow.id,
        flowTitle: flow.title,
        stepId: p.step.id,
        number: p.number,
      }));
  });
}

export interface FlowSummary {
  steps: number;
  branches: number;
  /** Distinct components touched by the flow's non-broken steps. */
  components: number;
  broken: number;
}

export function flowSummary(deck: SododeckFile, flowId: Id): FlowSummary | null {
  const flow = deck.flows.find((f) => f.id === flowId);
  if (flow === undefined) return null;
  const analysis = analyzeFlow(flow, deck.edges);
  const paths = [analysis.main, ...analysis.branches.map((b) => b.steps)].flat();
  const components = new Set(paths.flatMap((p) => (p.broken ? [] : [p.from, p.to])));
  return {
    steps: flow.steps.length,
    branches: flow.branches?.length ?? 0,
    components: components.size,
    broken: paths.filter((p) => p.broken).length,
  };
}

export function deckStats(deck: SododeckFile) {
  return {
    components: deck.nodes.length,
    connections: deck.edges.length,
    flows: deck.flows.length,
    rules: Object.keys(deck.rules).length,
  };
}

/** A rule's line in DECISION TABLES and the Attach list. */
export function ruleListItem(
  deck: SododeckFile,
  ruleId: Id,
): { title: string; rows: number; usedInSteps: number } | null {
  const rule = deck.rules[ruleId];
  if (rule === undefined) return null;
  return {
    title: rule.title,
    rows: rule.rows.length,
    usedInSteps: ruleUsage(deck, ruleId).steps.length,
  };
}

export type Shared<T> = { mixed: false; value: T } | { mixed: true };

function shared<T>(values: readonly T[]): Shared<T> {
  const [first] = values;
  return values.length > 0 && values.every((v) => v === first)
    ? { mixed: false, value: first as T }
    : { mixed: true };
}

export interface BulkView {
  kind: Shared<Node['type']>;
  owner: Shared<string>;
  tech: Shared<string>;
  group: Shared<Id | null>;
  /** Every tag on some selected component, first-seen order, with how many have it. */
  tags: { tag: string; count: number }[];
}

/** One shared value or Mixed per field, and tag counts, for bulk edit (FR-014, FR-016). */
export function bulkView(nodes: readonly Node[]): BulkView {
  // One entry per tag key, in the first spelling seen; a card holding two spellings counts once (033).
  const counts = new Map<string, { tag: string; count: number }>();
  for (const node of nodes) {
    const onCard = new Set<string>();
    for (const tag of node.tags ?? []) {
      const key = tagKey(tag);
      if (onCard.has(key)) continue;
      onCard.add(key);
      const entry = counts.get(key);
      if (entry === undefined) counts.set(key, { tag, count: 1 });
      else entry.count += 1;
    }
  }
  return {
    kind: shared(nodes.map((n) => n.type)),
    owner: shared(nodes.map((n) => n.owner ?? '')),
    tech: shared(nodes.map((n) => n.tech ?? '')),
    group: shared(nodes.map((n) => n.group ?? null)),
    tags: [...counts.values()],
  };
}

export interface StyleView {
  fill: Shared<ColorRef | null>;
  stroke: Shared<ColorRef | null>;
}

/** One shared colour (or `null` / Mixed) per channel, across selected components and groups (020). */
export function styleView(
  objects: readonly (Pick<Node, 'style'> | Pick<Group, 'style'>)[],
): StyleView {
  return {
    fill: shared(objects.map((o) => o.style?.fill ?? null)),
    stroke: shared(objects.map((o) => o.style?.stroke ?? null)),
  };
}
