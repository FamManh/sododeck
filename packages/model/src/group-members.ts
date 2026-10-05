/**
 * The cards inside a group, nested groups included. Pure, over a deck snapshot: the app uses it
 * to derive a group's lock state from its members (054) instead of storing a second flag.
 */
import type { Group, Id, Node } from '@sododeck/schema';

export function descendantNodeIds(
  deck: {
    nodes: readonly Pick<Node, 'id' | 'group'>[];
    groups: readonly Pick<Group, 'id' | 'parent'>[];
  },
  groupId: Id,
): Id[] {
  const children = new Map<Id, Id[]>();
  for (const group of deck.groups) {
    if (group.parent === undefined) continue;
    children.set(group.parent, [...(children.get(group.parent) ?? []), group.id]);
  }
  // The visited set also stops a hand-written cyclic `parent` chain.
  const inside = new Set<Id>();
  const stack: Id[] = [groupId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || inside.has(id)) continue;
    inside.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  const known = deck.groups.some((group) => group.id === groupId);
  if (!known) return [];
  const out = new Set<Id>();
  for (const node of deck.nodes) {
    if (node.group !== undefined && inside.has(node.group)) out.add(node.id);
  }
  return [...out];
}
