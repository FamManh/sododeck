/**
 * Connector ends (050, research R6; 053): an edge's `from` / `to` names a node, a group or a
 * sticky. Pure and JSON-based. Use this, not a node-only lookup, wherever an end is labelled.
 */
import type { Id, SododeckFile } from '@sododeck/schema';

import { stickyLabel } from './geometry';

export type EndpointKind = 'node' | 'group' | 'sticky';

export interface Endpoint {
  kind: EndpointKind;
  title: string;
}

/** `stickies` is optional so a caller holding only cards and groups still type-checks. */
type Ends = Pick<SododeckFile, 'nodes' | 'groups'> & Partial<Pick<SododeckFile, 'stickies'>>;
type Nodes = SododeckFile['nodes'];
type Groups = SododeckFile['groups'];
type Stickies = SododeckFile['stickies'];

const NO_STICKIES: Stickies = [];

interface Index {
  /** Collection sizes when built: a guard against a caller growing an array in place. */
  size: number;
  byId: ReadonlyMap<Id, Endpoint>;
}

/**
 * Index per (nodes, groups, stickies) triple. Snapshots keep untouched collections' identity, so repeated
 * lookups over one deck value (every edge of the search index or the problems list) build it once.
 */
const cache = new WeakMap<Nodes, WeakMap<Groups, WeakMap<Stickies, Index>>>();

/** What a sticky is called wherever an end is labelled; the same words the search index uses. */
const EMPTY_NOTE_TITLE = 'Empty note';

function build(deck: Ends): Index {
  const byId = new Map<Id, Endpoint>();
  const stickies = deck.stickies ?? NO_STICKIES;
  // Priority on a collision: cards first, then groups, then notes. Before 050 an end always named
  // a node, and before 053 never a note, so a hand-edited file keeps its meaning (the integrity
  // report flags the clash). Within one collection the first object wins.
  for (const node of deck.nodes) {
    if (!byId.has(node.id)) byId.set(node.id, { kind: 'node', title: node.title });
  }
  for (const group of deck.groups) {
    if (!byId.has(group.id)) byId.set(group.id, { kind: 'group', title: group.title });
  }
  for (const sticky of stickies) {
    if (!byId.has(sticky.id)) {
      byId.set(sticky.id, { kind: 'sticky', title: stickyLabel(sticky.text) ?? EMPTY_NOTE_TITLE });
    }
  }
  return { size: deck.nodes.length + deck.groups.length + stickies.length, byId };
}

function indexOf(deck: Ends): ReadonlyMap<Id, Endpoint> {
  const stickies = deck.stickies ?? NO_STICKIES;
  let byGroups = cache.get(deck.nodes);
  if (byGroups === undefined) {
    byGroups = new WeakMap();
    cache.set(deck.nodes, byGroups);
  }
  let byStickies = byGroups.get(deck.groups);
  if (byStickies === undefined) {
    byStickies = new WeakMap();
    byGroups.set(deck.groups, byStickies);
  }
  let index = byStickies.get(stickies);
  if (index?.size !== deck.nodes.length + deck.groups.length + stickies.length) {
    index = build(deck);
    byStickies.set(stickies, index);
  }
  return index.byId;
}

/** What the end `id` names: a node, a group or a sticky with its title, or null when it names neither. */
export function endpointOf(deck: Ends, id: Id): Endpoint | null {
  const found = indexOf(deck).get(id);
  return found === undefined ? null : { ...found };
}

/** The title of the end `id`, or the id itself when it names nothing (a broken reference). */
export function endpointTitle(deck: Ends, id: Id): string {
  return indexOf(deck).get(id)?.title ?? id;
}
