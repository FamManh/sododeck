/**
 * Group subtrees (016 R5, R10): what moves, copies or nests with a group. Pure; reads the real
 * deck, so members hidden in the current view move with their group too.
 */
import type { Id, SododeckFile } from '@sododeck/schema';

type Tree = Pick<SododeckFile, 'nodes' | 'groups'>;

/** The groups themselves, every nested group and every member node, in deck order. */
export function groupSubtree(deck: Tree, groupIds: readonly Id[]): { nodes: Id[]; groups: Id[] } {
  const children = new Map<Id, Id[]>();
  for (const group of deck.groups) {
    if (group.parent === undefined) continue;
    children.set(group.parent, [...(children.get(group.parent) ?? []), group.id]);
  }
  const known = new Set(deck.groups.map((g) => g.id));
  const inside = new Set<Id>();
  const stack = groupIds.filter((id) => known.has(id));
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || inside.has(id)) continue;
    inside.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return {
    nodes: deck.nodes.filter((n) => n.group !== undefined && inside.has(n.group)).map((n) => n.id),
    groups: deck.groups.filter((g) => inside.has(g.id)).map((g) => g.id),
  };
}

/** `groupId` and its enclosing groups, innermost first. Empty for undefined; stops on cycles. */
export function groupAncestors(deck: Pick<SododeckFile, 'groups'>, groupId: Id | undefined): Id[] {
  const parents = new Map(deck.groups.map((g) => [g.id, g.parent]));
  const out: Id[] = [];
  let current = groupId;
  while (current !== undefined && parents.has(current) && !out.includes(current)) {
    out.push(current);
    current = parents.get(current);
  }
  return out;
}

/** The images (055) that are members of `groupIds` or of a group nested in them, in deck order. */
export function groupSubtreeImages(
  deck: Tree & Partial<Pick<SododeckFile, 'images'>>,
  groupIds: readonly Id[],
): Id[] {
  const inside = new Set(groupSubtree(deck, groupIds).groups);
  return (deck.images ?? [])
    .filter((image) => image.group !== undefined && inside.has(image.group))
    .map((image) => image.id);
}
