/**
 * The cards and images inside a group, nested groups included. Pure, over a deck snapshot: the app
 * uses it to derive a group's lock state from its members (054, 055) instead of storing a second
 * flag, and to move or hide a group's members together.
 */
import type { Group, Id, Image, Node } from '@sododeck/schema';

type Groups = readonly Pick<Group, 'id' | 'parent'>[];

/** The group and every group nested in it; empty when `groupId` names none. Cycle-safe. */
function groupsInside(groups: Groups, groupId: Id): Set<Id> {
  const children = new Map<Id, Id[]>();
  for (const group of groups) {
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
  return groups.some((group) => group.id === groupId) ? inside : new Set();
}

function membersInside(members: readonly { id: Id; group?: Id }[], inside: Set<Id>): Id[] {
  const out = new Set<Id>();
  for (const member of members) {
    if (member.group !== undefined && inside.has(member.group)) out.add(member.id);
  }
  return [...out];
}

export function descendantNodeIds(
  deck: { nodes: readonly Pick<Node, 'id' | 'group'>[]; groups: Groups },
  groupId: Id,
): Id[] {
  return membersInside(deck.nodes, groupsInside(deck.groups, groupId));
}

/** The images inside a group, nested groups included (055). */
export function descendantImageIds(
  deck: { images?: readonly Pick<Image, 'id' | 'group'>[]; groups: Groups },
  groupId: Id,
): Id[] {
  return membersInside(deck.images ?? [], groupsInside(deck.groups, groupId));
}
