/**
 * A group's lock (054, research R5): derived from its cards, never stored. Pure and free of the
 * app's stores, so the canvas projection (`deck-to-flow.ts`) can use it too.
 */
import { descendantImageIds, descendantNodeIds, isLocked } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

export type GroupLockState = 'locked' | 'unlocked' | 'empty';

/**
 * A group's lock is derived, never stored (054, research R5): it reads `locked` when it holds
 * cards (nested groups included) and every one is locked. A card added later therefore makes it
 * read `unlocked` again, and an empty group has no lock to show.
 */
export function groupLockState(
  deck: Pick<SododeckFile, 'nodes' | 'groups'>,
  groupId: Id,
): GroupLockState {
  const members = new Set(descendantNodeIds(deck, groupId));
  if (members.size === 0) return 'empty';
  return deck.nodes.every((node) => !members.has(node.id) || isLocked(node))
    ? 'locked'
    : 'unlocked';
}

/**
 * Every locked group of the deck in one pass (a card counts for its group and all its ancestors),
 * for the canvas, which asks about every frame on each change. Same rule as `groupLockState`.
 */
export function lockedGroupIds(deck: Pick<SododeckFile, 'nodes' | 'groups'>): ReadonlySet<Id> {
  const parentOf = new Map<Id, Id | undefined>(deck.groups.map((g) => [g.id, g.parent]));
  const total = new Map<Id, number>();
  const locked = new Map<Id, number>();
  for (const node of deck.nodes) {
    // The seen set stops a hand-written cyclic `parent` chain.
    const seen = new Set<Id>();
    for (let id = node.group; id !== undefined && !seen.has(id); id = parentOf.get(id)) {
      seen.add(id);
      total.set(id, (total.get(id) ?? 0) + 1);
      if (isLocked(node)) locked.set(id, (locked.get(id) ?? 0) + 1);
    }
  }
  return new Set(
    deck.groups
      .filter((g) => (total.get(g.id) ?? 0) > 0 && total.get(g.id) === locked.get(g.id))
      .map((g) => g.id),
  );
}

/** Whether group `id` is locked: refuses move, resize and delete (054). */
export function isGroupLocked(deck: Pick<SododeckFile, 'nodes' | 'groups'>, id: Id): boolean {
  return groupLockState(deck, id) === 'locked';
}

/**
 * The cards Lock acts on for a selection: the selected cards and every card inside a selected
 * group, each once. Notes and connectors are skipped (they have their own Lock, 053).
 */
export function lockableIds(
  deck: Pick<SododeckFile, 'nodes' | 'groups'>,
  selection: { readonly nodes: readonly Id[]; readonly groups: readonly Id[] },
): Id[] {
  const known = new Set(deck.nodes.map((node) => node.id));
  const out = new Set(selection.nodes.filter((id) => known.has(id)));
  for (const groupId of selection.groups) {
    for (const id of descendantNodeIds(deck, groupId)) out.add(id);
  }
  return [...out];
}

/**
 * The images Lock acts on for a selection (055): the selected images and every image inside a
 * selected group, each once. Locking a group locks its pictures with its cards.
 */
export function lockableImageIds(
  deck: Pick<SododeckFile, 'nodes' | 'groups'> & Partial<Pick<SododeckFile, 'images'>>,
  selection: { readonly images?: readonly Id[]; readonly groups: readonly Id[] },
): Id[] {
  const known = new Set((deck.images ?? []).map((image) => image.id));
  const out = new Set((selection.images ?? []).filter((id) => known.has(id)));
  for (const groupId of selection.groups) {
    for (const id of descendantImageIds(deck, groupId)) out.add(id);
  }
  return [...out];
}
