/**
 * Locked cards (043 R11, FR-023): what the canvas refuses for a node with `locked: true`, and the
 * one sentence it says when it does. The flag is document data (`editor.setLocked`).
 */
import { isLocked, type RemovalTarget } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import { useUiStore } from '../state/ui-store';

/** The tooltip and announcement for a refused gesture on a locked card. */
export const LOCKED_HINT = 'Locked · unlock to move or edit';

/** Whether node `id` of `deck` is locked. */
export function isNodeLocked(deck: Pick<SododeckFile, 'nodes'>, id: Id): boolean {
  const node = deck.nodes.find((n) => n.id === id);
  return node !== undefined && isLocked(node);
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
 * Locked cards are never deleted (043 FR-024): the targets without them, and how many were
 * skipped. The single choke point for the Delete key, the menu and Cut.
 */
export function withoutLocked(
  deck: Pick<SododeckFile, 'nodes'>,
  targets: readonly RemovalTarget[],
): { targets: RemovalTarget[]; skipped: number } {
  const locked = new Set(deck.nodes.filter(isLocked).map((node) => node.id));
  const kept = targets.filter((target) => target.scope !== 'nodes' || !locked.has(target.id));
  return { targets: kept, skipped: targets.length - kept.length };
}
