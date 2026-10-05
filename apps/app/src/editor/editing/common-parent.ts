/**
 * The group a new group or a copy goes into (016 R11): the innermost group that holds every item.
 * A node or image counts from its own group, a group from its enclosing group (never itself).
 */
import type { Id, SododeckFile } from '@sododeck/schema';

import { groupAncestors } from './subtree';

export function commonParent(
  deck: Pick<SododeckFile, 'nodes' | 'groups'> & Partial<Pick<SododeckFile, 'images'>>,
  items: { nodes: readonly Id[]; groups: readonly Id[]; images?: readonly Id[] },
): Id | undefined {
  const byNode = new Map(deck.nodes.map((n) => [n.id, n.group]));
  const byGroup = new Map(deck.groups.map((g) => [g.id, g.parent]));
  const byImage = new Map((deck.images ?? []).map((i) => [i.id, i.group]));
  const chains = [
    ...items.nodes.map((id) => groupAncestors(deck, byNode.get(id))),
    ...(items.images ?? []).map((id) => groupAncestors(deck, byImage.get(id))),
    ...items.groups.map((id) => groupAncestors(deck, byGroup.get(id))),
  ];
  const [first, ...rest] = chains;
  if (first === undefined) return undefined;
  return first.find((id) => rest.every((chain) => chain.includes(id)));
}
