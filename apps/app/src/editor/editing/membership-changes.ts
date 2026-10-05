/**
 * Membership on drop (016 research R6, FR-018–020): each dragged top-level item goes to the frame
 * under the pointer, else the drilled-in group, else the top level. ⌥ keeps membership. Members
 * of a dragged group stay in it; a group never goes into itself or a descendant.
 */
import type { Id, SododeckFile } from '@sododeck/schema';

import { groupAncestors, groupSubtree, groupSubtreeImages } from './subtree';

export interface MembershipChange {
  kind: 'node' | 'group' | 'image';
  id: Id;
  from: Id | undefined;
  to: Id | undefined;
}

export interface DropOptions {
  /** The frame under the pointer (`dropTarget`). */
  target: Id | null;
  /** The group the canvas is drilled into, if any. */
  scope: Id | undefined;
  /** ⌥ held: drop without changing any group. */
  keep: boolean;
}

export function membershipChanges(
  deck: Pick<SododeckFile, 'nodes' | 'groups'> & Partial<Pick<SododeckFile, 'images'>>,
  dragged: { nodes: readonly Id[]; groups: readonly Id[]; images?: readonly Id[] },
  { target, scope, keep }: DropOptions,
): MembershipChange[] {
  if (keep) return [];
  const to = target ?? scope;
  // Everything inside a dragged group moves with it and keeps its membership.
  const carried = groupSubtree(deck, dragged.groups);
  const inside = new Set(carried.groups);
  const members = new Set(carried.nodes);
  const changes: MembershipChange[] = [];
  const groupsById = new Map(deck.groups.map((g) => [g.id, g]));
  for (const id of dragged.groups) {
    const group = groupsById.get(id);
    if (group === undefined) continue;
    if (group.parent !== undefined && inside.has(group.parent)) continue;
    if (to !== undefined && groupAncestors(deck, to).includes(id)) continue;
    if (group.parent !== to) changes.push({ kind: 'group', id, from: group.parent, to });
  }
  const nodesById = new Map(deck.nodes.map((n) => [n.id, n]));
  for (const id of dragged.nodes) {
    const node = nodesById.get(id);
    if (node === undefined || members.has(id)) continue;
    if (node.group !== to) changes.push({ kind: 'node', id, from: node.group, to });
  }
  // Images (055) join and leave groups like cards; those inside a dragged group stay in it.
  const carriedImages = new Set(groupSubtreeImages(deck, dragged.groups));
  const imagesById = new Map((deck.images ?? []).map((i) => [i.id, i]));
  for (const id of dragged.images ?? []) {
    const image = imagesById.get(id);
    if (image === undefined || carriedImages.has(id)) continue;
    if (image.group !== to) changes.push({ kind: 'image', id, from: image.group, to });
  }
  return changes;
}
