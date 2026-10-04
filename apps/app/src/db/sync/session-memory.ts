/**
 * Session memory for cut and paste (046 research R7): a table removed by an apply is kept, with its
 * relationships, until the panel closes. Typing a table of the same name back restores it with its
 * old ids and position. Pure; the panel owns the `Map`.
 */
import type { Id, Node, SododeckFile } from '@sododeck/schema';

import { schemaName } from './normalise';
import type { RememberedTable, SessionMemory } from './types';

export const memoryKey = (node: Pick<Node, 'title' | 'schema'>): string => {
  const schema = schemaName(node.schema);
  const name = node.title.trim();
  return (schema === undefined ? name : `${schema}.${name}`).toLowerCase();
};

export function createSessionMemory(): SessionMemory {
  return new Map();
}

/** Captures the tables `ids` (node JSON and every relationship touching them) before removal. */
export function rememberTables(
  memory: SessionMemory,
  deck: SododeckFile,
  ids: readonly Id[],
): void {
  const wanted = new Set(ids);
  for (const node of deck.nodes) {
    if (!wanted.has(node.id)) continue;
    const edges = deck.edges.filter((e) => e.from === node.id || e.to === node.id);
    memory.set(memoryKey(node), { node: structuredClone(node), edges: structuredClone(edges) });
  }
}

/** The remembered table of `key` (lower-cased `schema.name`), without removing it. */
export function recall(memory: SessionMemory, key: string): RememberedTable | undefined {
  return memory.get(key);
}

/** Forgets a table once it is back (or the panel closes). */
export function forget(memory: SessionMemory, key: string): void {
  memory.delete(key);
}

export function clearMemory(memory: SessionMemory): void {
  memory.clear();
}
