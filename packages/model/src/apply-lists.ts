/**
 * Ordered-list reconciliation for applying a file (066 research R3): make a layout-2 list hold the
 * file's ids in the file's order with the fewest order-key writes. Items on the longest run that
 * is already in order keep their keys; every other kept item gets one new key between its placed
 * neighbours, and new items are created there. A list whose keys cannot give a key in between
 * (tied or malformed keys) is re-keyed whole, as `insertAt` does.
 */
import type { Id } from '@sododeck/schema';

import type { YObject } from './convert';
import { orderedEntries, orderOf, rekeyAll, setOrder, type ListMap } from './layout';
import { keyBetween } from './order-key';

export interface ReconcileResult {
  /** Ids created, in target order. */
  added: Id[];
  /** Ids deleted, in stored order. */
  removed: Id[];
  /** Kept ids whose order key was rewritten, in target order. */
  moved: Id[];
}

/**
 * The positions (indexes into `values`) of one longest strictly increasing subsequence, by
 * patience sorting with back links: O(n log n).
 */
export function longestIncreasing(values: readonly number[]): Set<number> {
  const tails: number[] = [];
  const back: number[] = new Array<number>(values.length).fill(-1);
  values.forEach((value, i) => {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((values[tails[mid] ?? 0] ?? 0) < value) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) back[i] = tails[lo - 1] ?? -1;
    tails[lo] = i;
  });
  const out = new Set<number>();
  let at = tails[tails.length - 1] ?? -1;
  while (at !== -1) {
    out.add(at);
    at = back[at] ?? -1;
  }
  return out;
}

/** A neighbour's key as `keyBetween` takes it: a missing key (`''`) is an open end. */
const bound = (key: string | null) => (key === '' ? null : key);

/**
 * Makes `list` hold exactly `targetIds` in that order. Ids absent from the target are deleted,
 * new ids are built by `create(id, orderKey)` and attached, and `update(id, map)` runs for every
 * kept id (after the order is set). Call inside a transaction.
 */
export function reconcileOrder(
  list: ListMap,
  targetIds: readonly Id[],
  create: (id: Id, order: string) => YObject,
  update: (id: Id, map: YObject) => void,
): ReconcileResult {
  const target = new Set(targetIds);
  const removed: Id[] = [];
  for (const [id] of orderedEntries(list)) {
    if (!target.has(id)) {
      list.delete(id);
      removed.push(id);
    }
  }

  const position = new Map<Id, number>();
  orderedEntries(list).forEach(([id], i) => position.set(id, i));
  const kept = targetIds.filter((id) => position.has(id));
  const before = new Map(kept.map((id) => [id, orderOf(list.get(id) as YObject)]));
  const run = longestIncreasing(kept.map((id) => position.get(id) ?? 0));
  const stable = new Set([...run].map((i) => kept[i] ?? ''));

  // The key of the next stable item after each target position: new keys go below it.
  const nextKeys: (string | null)[] = new Array<string | null>(targetIds.length).fill(null);
  let next: string | null = null;
  for (let i = targetIds.length - 1; i >= 0; i--) {
    nextKeys[i] = next;
    const id = targetIds[i] ?? '';
    if (stable.has(id)) next = before.get(id) ?? '';
  }

  const added = new Set<Id>();
  try {
    let prev: string | null = null;
    targetIds.forEach((id, i) => {
      if (stable.has(id)) {
        prev = before.get(id) ?? '';
        return;
      }
      const key = keyBetween(bound(prev), bound(nextKeys[i] ?? null));
      const existing = list.get(id);
      if (existing === undefined) {
        list.set(id, create(id, key));
        added.add(id);
      } else {
        setOrder(list, existing, key);
      }
      prev = key;
    });
  } catch {
    // Tied or malformed keys: no key fits between the neighbours, so give every item a new one.
    for (const id of targetIds) {
      if (!list.has(id)) {
        list.set(id, create(id, ''));
        added.add(id);
      }
    }
    rekeyAll(
      list,
      targetIds.map((id) => list.get(id) as YObject),
    );
  }

  const moved = kept.filter((id) => orderOf(list.get(id) as YObject) !== before.get(id));
  for (const id of kept) update(id, list.get(id) as YObject);
  return { added: targetIds.filter((id) => added.has(id)), removed, moved };
}
