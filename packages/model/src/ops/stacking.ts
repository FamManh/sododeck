/**
 * Stacking (055, research R2): cards and images share one order, kept as a `z` rank on each. These
 * ops write it, and keep the order of `nodes` equal to the cards' stacking order so a build that
 * does not read `z` still draws cards the way they were arranged.
 *
 * `z` is written only when the deck holds images or some card already has a `z`: a deck without
 * images keeps its `nodes` order as the only stack, byte-identical to before.
 */
import type { Id } from '@sododeck/schema';

import { collectionMap, orderedEntries, planMove, type DeckDoc } from '../layout';
import { sortStack, type StackEntry } from '../stack-order';
import type { EditContext } from './context';
import { assertUnlocked } from './node-lock';

export type ArrangeMove = 'front' | 'back' | 'forward' | 'backward';

const COLLECTION = { node: 'nodes', image: 'images' } as const;

function rankOf(map: { get(key: string): unknown }, index: number): number {
  const z = map.get('z');
  return typeof z === 'number' ? z : index;
}

/** The deck's stack, back to front, read straight from the stored maps. */
export function readStack(doc: DeckDoc): StackEntry[] {
  const entries: StackEntry[] = [];
  for (const kind of ['node', 'image'] as const) {
    orderedEntries(collectionMap(doc, COLLECTION[kind])).forEach(([id, map], index) => {
      entries.push({ kind, id, rank: rankOf(map, index) });
    });
  }
  return sortStack(entries);
}

/** True when ranks must be written: the deck holds images, or a card already has a `z`. */
export function usesRanks(doc: DeckDoc): boolean {
  if (collectionMap(doc, 'images').size > 0) return true;
  for (const node of collectionMap(doc, 'nodes').values()) if (node.has('z')) return true;
  return false;
}

/**
 * The `z` for items added on top (55): one above everything, or `undefined` when the deck does not
 * use ranks (no images, no card `z`) and the array position is the whole story. Reads the stored
 * maps without sorting.
 */
export function nextRank(doc: DeckDoc): number | undefined {
  return usesRanks(doc) ? topRankOf(doc) : undefined;
}

/** One above the largest `z` and above every index-ranked item (at most `count - 1` each). */
export function topRankOf(doc: DeckDoc): number {
  const nodes = collectionMap(doc, 'nodes');
  const images = collectionMap(doc, 'images');
  let top = Math.max(nodes.size, images.size) - 1;
  for (const list of [nodes, images]) {
    for (const map of list.values()) {
      const z = map.get('z');
      if (typeof z === 'number' && z > top) top = z;
    }
  }
  return top + 1;
}

/** The new order after `move`, the picked items keeping their relative order. */
export function arranged(
  order: readonly StackEntry[],
  picked: ReadonlySet<string>,
  move: ArrangeMove,
): StackEntry[] {
  const key = (entry: StackEntry) => `${entry.kind}:${entry.id}`;
  const out = [...order];
  if (move === 'front' || move === 'back') {
    const chosen = out.filter((entry) => picked.has(key(entry)));
    const rest = out.filter((entry) => !picked.has(key(entry)));
    return move === 'front' ? [...rest, ...chosen] : [...chosen, ...rest];
  }
  const swap = (i: number, j: number) => {
    const held = out[i];
    out[i] = out[j] as StackEntry;
    out[j] = held as StackEntry;
  };
  if (move === 'forward') {
    for (let i = out.length - 2; i >= 0; i--) {
      if (picked.has(key(out[i] as StackEntry)) && !picked.has(key(out[i + 1] as StackEntry))) {
        swap(i, i + 1);
      }
    }
  } else {
    for (let i = 1; i < out.length; i++) {
      if (picked.has(key(out[i] as StackEntry)) && !picked.has(key(out[i - 1] as StackEntry))) {
        swap(i, i - 1);
      }
    }
  }
  return out;
}

export interface StackTargets {
  nodes?: readonly Id[];
  images?: readonly Id[];
}

/**
 * Brings the listed cards and images to the front or back, or one step forward or backward past
 * the next item that is not listed. One undo step. Unknown ids are skipped; a locked image is
 * refused (`locked`) before anything is written. Writes contiguous ranks `0…n-1` when the deck uses
 * ranks, and always puts `nodes` in the order of the cards' stacking.
 */
export function restack(ctx: EditContext, targets: StackTargets, move: ArrangeMove): void {
  const { doc } = ctx;
  const images = collectionMap(doc, 'images');
  const picked = new Set<string>();
  for (const id of targets.nodes ?? []) {
    if (collectionMap(doc, 'nodes').has(id)) picked.add(`node:${id}`);
  }
  for (const id of new Set(targets.images ?? [])) {
    const map = images.get(id);
    if (map === undefined) continue;
    assertUnlocked(map, 'Image', id, 'change its stacking');
    picked.add(`image:${id}`);
  }
  if (picked.size === 0) return;

  const before = readStack(doc);
  const after = arranged(before, picked, move);
  const ranked = usesRanks(doc);
  const sameOrder = after.every((entry, i) => entry === before[i]);
  const cards = after.filter((entry) => entry.kind === 'node').map((entry) => entry.id);
  const nodes = collectionMap(doc, 'nodes');
  const current = orderedEntries(nodes).map(([id]) => id);
  const nodeOrderChanged = cards.some((id, i) => current[i] !== id);
  const rankChanges = ranked
    ? after.flatMap((entry, rank) => {
        const map = collectionMap(doc, COLLECTION[entry.kind]).get(entry.id);
        return map !== undefined && map.get('z') !== rank ? [{ map, rank }] : [];
      })
    : [];
  if (sameOrder && !nodeOrderChanged && rankChanges.length === 0) return;

  ctx.transact(() => {
    for (const { map, rank } of rankChanges) map.set('z', rank);
    // Move cards one at a time into place; each move is one order-key write.
    const sequence = [...current];
    cards.forEach((id, index) => {
      if (sequence[index] === id) return;
      planMove(nodes, id, index)?.();
      sequence.splice(sequence.indexOf(id), 1);
      sequence.splice(index, 0, id);
    });
  });
}
