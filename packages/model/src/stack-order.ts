/**
 * The stacking order shared by cards and images (055, research R2): one list from back to front.
 * An item's rank is its `z` when it has one, else its index in its own collection (`nodes` or
 * `images`); a higher rank draws on top, and on a tie cards draw before images. A deck without
 * images and without any `z` keeps the order of `nodes`, exactly as before. Pure, so the canvas,
 * the export and the arrange ops agree.
 */
import type { Id, SododeckFile } from '@sododeck/schema';

export type StackKind = 'node' | 'image';

export interface StackEntry {
  kind: StackKind;
  id: Id;
  /** The item's rank: its `z`, else its index in its collection. */
  rank: number;
}

type Stackable = Pick<SododeckFile, 'nodes'> & Partial<Pick<SododeckFile, 'images'>>;

/** Items sorted back to front: rank, then cards before images, then position in the collection. */
export function sortStack(entries: readonly StackEntry[]): StackEntry[] {
  // Entries are listed cards first, each collection in order, so a stable sort breaks ties by that.
  return [...entries].sort(
    (a, b) => a.rank - b.rank || (a.kind === b.kind ? 0 : a.kind === 'node' ? -1 : 1),
  );
}

/** Cards and images of `deck`, back to front (the last entry is drawn on top). */
export function stackOrder(deck: Stackable): StackEntry[] {
  const entries: StackEntry[] = [];
  deck.nodes.forEach((node, index) => {
    entries.push({ kind: 'node', id: node.id, rank: node.z ?? index });
  });
  (deck.images ?? []).forEach((image, index) => {
    entries.push({ kind: 'image', id: image.id, rank: image.z ?? index });
  });
  return sortStack(entries);
}

/**
 * The rank a new item takes to draw above everything: one above the largest `z`, and above every
 * index-ranked item (at most `count - 1` in each collection).
 */
export function topRank(deck: Stackable): number {
  let top = Math.max(deck.nodes.length, deck.images?.length ?? 0) - 1;
  for (const node of deck.nodes) if (node.z !== undefined && node.z > top) top = node.z;
  for (const image of deck.images ?? []) if (image.z !== undefined && image.z > top) top = image.z;
  return top + 1;
}
