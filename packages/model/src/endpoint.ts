/**
 * Connector ends (050, research R6): an edge's `from` / `to` names a node or a group. Pure and
 * JSON-based. Use this, not a node-only lookup, wherever an end is labelled.
 */
import type { Id, SododeckFile } from '@sododeck/schema';

export type EndpointKind = 'node' | 'group';

export interface Endpoint {
  kind: EndpointKind;
  title: string;
}

type Ends = Pick<SododeckFile, 'nodes' | 'groups'>;
type Nodes = SododeckFile['nodes'];
type Groups = SododeckFile['groups'];

interface Index {
  /** Collection sizes when built: a guard against a caller growing an array in place. */
  size: number;
  byId: ReadonlyMap<Id, Endpoint>;
}

/**
 * Index per (nodes, groups) pair. Snapshots keep untouched collections' identity, so repeated
 * lookups over one deck value (every edge of the search index or the problems list) build it once.
 */
const cache = new WeakMap<Nodes, WeakMap<Groups, Index>>();

function build(deck: Ends): Index {
  const byId = new Map<Id, Endpoint>();
  for (const group of deck.groups) {
    if (!byId.has(group.id)) byId.set(group.id, { kind: 'group', title: group.title });
  }
  // Nodes win a collision: before 050 an end always named a node, so a hand-edited file that
  // gives a node and a group one id keeps its meaning (the integrity report flags it).
  const seen = new Set<Id>();
  for (const node of deck.nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    byId.set(node.id, { kind: 'node', title: node.title });
  }
  return { size: deck.nodes.length + deck.groups.length, byId };
}

function indexOf(deck: Ends): ReadonlyMap<Id, Endpoint> {
  let byGroups = cache.get(deck.nodes);
  if (byGroups === undefined) {
    byGroups = new WeakMap();
    cache.set(deck.nodes, byGroups);
  }
  let index = byGroups.get(deck.groups);
  if (index?.size !== deck.nodes.length + deck.groups.length) {
    index = build(deck);
    byGroups.set(deck.groups, index);
  }
  return index.byId;
}

/** What the end `id` names: a node or a group with its title, or null when it names neither. */
export function endpointOf(deck: Ends, id: Id): Endpoint | null {
  const found = indexOf(deck).get(id);
  return found === undefined ? null : { ...found };
}

/** The title of the end `id`, or the id itself when it names nothing (a broken reference). */
export function endpointTitle(deck: Ends, id: Id): string {
  return indexOf(deck).get(id)?.title ?? id;
}
