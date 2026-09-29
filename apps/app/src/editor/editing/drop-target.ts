/**
 * Where a drop lands (016 research R6, screen 110): the innermost group frame under the pointer.
 * "The pointer decides": frames never capture cards by covering them (FR-046).
 */
import type { Id, SododeckFile } from '@sododeck/schema';

import type { Point, Rect } from '../canvas-geometry';
import { groupAncestors } from './subtree';

export interface FrameEntry {
  id: Id;
  rect: Rect;
  /** How many groups enclose this one (0 at the top level). */
  depth: number;
}

/** The frames drawn for `shown` groups (from `groupBounds`), with their depth. */
export function frameEntries(
  deck: Pick<SododeckFile, 'groups'>,
  bounds: ReadonlyMap<Id, Rect>,
  shown: readonly Id[],
): FrameEntry[] {
  return shown.flatMap((id) => {
    const rect = bounds.get(id);
    return rect === undefined ? [] : [{ id, rect, depth: groupAncestors(deck, id).length - 1 }];
  });
}

const contains = (rect: Rect, p: Point) =>
  p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;

/**
 * The innermost frame containing `pointer`: the deepest, then the smaller area. `excluded` are the
 * dragged groups and their descendants (a group never drops into itself). Null outside frames.
 */
export function dropTarget(
  frames: readonly FrameEntry[],
  pointer: Point,
  excluded: ReadonlySet<Id>,
): Id | null {
  let best: FrameEntry | null = null;
  for (const frame of frames) {
    if (excluded.has(frame.id) || !contains(frame.rect, pointer)) continue;
    if (
      best === null ||
      frame.depth > best.depth ||
      (frame.depth === best.depth &&
        frame.rect.width * frame.rect.height < best.rect.width * best.rect.height)
    ) {
      best = frame;
    }
  }
  return best?.id ?? null;
}
