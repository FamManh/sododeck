import type { Id } from '@sododeck/schema';

export type PinState = 'none' | 'some' | 'all';

/** How many of `nodeIds` are pinned in the current view. */
export function pinState(nodeIds: readonly Id[], pinned: ReadonlySet<Id>): PinState {
  const count = nodeIds.filter((id) => pinned.has(id)).length;
  return count === 0 ? 'none' : count === nodeIds.length ? 'all' : 'some';
}

/** "Pinned component" / "Unpinned 3 components". */
export function pinAnnouncement(pin: boolean, n: number): string {
  return `${pin ? 'Pinned' : 'Unpinned'} ${n === 1 ? 'component' : `${String(n)} components`}`;
}
