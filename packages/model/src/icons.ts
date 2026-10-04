/** Icon references used by a deck, for the picker's "Used in this deck" section (038). */
import type { SododeckFile } from '@sododeck/schema';

export interface IconUsage {
  ref: string;
  count: number;
}

/**
 * Every `node.icon` of the deck as written, most used first, ties by first appearance in node
 * order. `server` and `lucide:server` are separate rows; the app merges rows that resolve to the
 * same icon. A deck without icons gives `[]`.
 */
export function iconUsage(deck: Pick<SododeckFile, 'nodes'>): IconUsage[] {
  const counts = new Map<string, number>();
  for (const node of deck.nodes) {
    if (node.icon !== undefined) counts.set(node.icon, (counts.get(node.icon) ?? 0) + 1);
  }
  // Array.prototype.sort is stable, so equal counts keep first-appearance (insertion) order.
  return [...counts].map(([ref, count]) => ({ ref, count })).sort((a, b) => b.count - a.count);
}
