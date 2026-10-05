/**
 * Locks (043 cards, 053 notes and connectors): what the canvas refuses for an object with
 * `locked: true`, and the one sentence it says when it does. The flag is document data
 * (`editor.setLocked`). The model also refuses writes on a locked note or connector, so every
 * app path filters locked ids first instead of letting a batch throw half way.
 */
import { isLocked, type DeckEditor, type RemovalTarget } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import { readDeck } from '../model/use-deck-snapshot';
import { lockedGroupIds } from './group-lock';
import { useUiStore } from '../state/ui-store';

export {
  groupLockState,
  isGroupLocked,
  lockableIds,
  lockedGroupIds,
  type GroupLockState,
} from './group-lock';

/** The tooltip and announcement for a refused gesture on a locked card. */
export const LOCKED_HINT = 'Locked · unlock to move or edit';

/** Whether node `id` of `deck` is locked. */
export function isNodeLocked(deck: Pick<SododeckFile, 'nodes'>, id: Id): boolean {
  const node = deck.nodes.find((n) => n.id === id);
  return node !== undefined && isLocked(node);
}

/** Whether connector `id` of `deck` is locked (053). */
export function isEdgeLocked(deck: Pick<SododeckFile, 'edges'>, id: Id): boolean {
  const edge = deck.edges.find((e) => e.id === id);
  return edge !== undefined && isLocked(edge);
}

/** Whether note `id` of `deck` is locked (053). */
export function isStickyLocked(deck: Pick<SododeckFile, 'stickies'>, id: Id): boolean {
  const sticky = deck.stickies.find((s) => s.id === id);
  return sticky !== undefined && isLocked(sticky);
}

/** The ids of `ids` of one collection that are not locked, and how many were skipped. */
export function unlockedIds(
  deck: Pick<SododeckFile, 'nodes' | 'edges' | 'stickies'>,
  collection: 'nodes' | 'edges' | 'stickies',
  ids: readonly Id[],
): { ids: Id[]; skipped: number } {
  const locked = new Set(deck[collection].filter(isLocked).map((o) => o.id));
  const kept = ids.filter((id) => !locked.has(id));
  return { ids: kept, skipped: ids.length - kept.length };
}

/** The ids of `ids` that are not locked, and how many were skipped. */
export function unlockedOf(
  deck: Pick<SododeckFile, 'nodes'>,
  ids: readonly Id[],
): { ids: Id[]; skipped: number } {
  const locked = new Set(deck.nodes.filter(isLocked).map((n) => n.id));
  const kept = ids.filter((id) => !locked.has(id));
  return { ids: kept, skipped: ids.length - kept.length };
}

/** Says why nothing happened: the card is locked. Returns true so callers can `return refuse…`. */
export function refuseLocked(): true {
  useUiStore.getState().announce(LOCKED_HINT);
  return true;
}

/**
 * The connectors of `ids` a style write may touch (locked ones refuse it). When none is left it
 * says why and returns `null`; otherwise `note` is the suffix for the announcement.
 */
export function editableEdges(
  editor: DeckEditor,
  ids: readonly Id[],
): { ids: Id[]; note: string } | null {
  const { ids: free, skipped } = unlockedIds(readDeck(editor.doc), 'edges', ids);
  if (free.length === 0) {
    if (skipped > 0) refuseLocked();
    return null;
  }
  return { ids: free, note: skipped > 0 ? ` · skipped ${String(skipped)} locked` : '' };
}

/**
 * Locked cards, notes, connectors and groups are never deleted (043 FR-024, 053, 054): the targets without
 * them, and how many were skipped. The single choke point for the Delete key, the menu and Cut.
 */
export function withoutLocked(
  deck: Pick<SododeckFile, 'nodes' | 'edges' | 'stickies'> &
    Partial<Pick<SododeckFile, 'groups' | 'images'>>,
  targets: readonly RemovalTarget[],
): { targets: RemovalTarget[]; skipped: number } {
  const locked = {
    nodes: new Set(deck.nodes.filter(isLocked).map((o) => o.id)),
    edges: new Set(deck.edges.filter(isLocked).map((o) => o.id)),
    stickies: new Set(deck.stickies.filter(isLocked).map((o) => o.id)),
    images: new Set((deck.images ?? []).filter(isLocked).map((o) => o.id)),
    // A group is locked when all its cards are (054); a deck without `groups` has none.
    groups: lockedGroupIds({ nodes: deck.nodes, groups: deck.groups ?? [] }),
  };
  const kept = targets.filter(
    (target) =>
      (target.scope !== 'nodes' &&
        target.scope !== 'edges' &&
        target.scope !== 'stickies' &&
        target.scope !== 'images' &&
        target.scope !== 'groups') ||
      !locked[target.scope].has(target.id),
  );
  return { targets: kept, skipped: targets.length - kept.length };
}
