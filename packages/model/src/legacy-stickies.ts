/**
 * Legacy pinned notes (ADR 0041). Notes used to be pinned to an object through `anchor`, with
 * `position` read as an offset from it (ADR 0010). Pinning is gone: every note is free, placed by
 * its own absolute `position`. A file or a stored deck that still holds an anchored note is
 * turned into a free note at the canvas point the note was shown at, so nothing moves on screen.
 *
 * - Anchored to a card: the card's canvas point plus the offset (or the old default offset).
 * - Anchored to anything else (a connector, a flow, a step…) or to nothing that exists: the note
 *   was drawn at its own `position` (the origin when it had none), and stays there.
 */
import type { SododeckFile, Sticky } from '@sododeck/schema';

import { nodeCanvasPosition, stickyPosition, type Point } from './geometry';

/** Offset of a pinned note that had no stored position (ADR 0010). */
const LEGACY_PIN_OFFSET: Point = { x: 24, y: -96 };

/** The absolute canvas point a legacy anchored note was shown at; a free note's own position. */
export function legacyStickyPoint(file: SododeckFile, sticky: Sticky): Point {
  if (sticky.anchor === undefined) return stickyPosition(sticky);
  const base = nodeCanvasPosition(file, sticky.anchor);
  if (base === null) return stickyPosition(sticky);
  const offset = sticky.position ?? LEGACY_PIN_OFFSET;
  return { x: base.x + offset.x, y: base.y + offset.y };
}

/**
 * The file with every anchored note made free at the point it was shown at (`anchor` dropped,
 * `position` absolute). Returns `file` itself when no note has an anchor, so current files load
 * unchanged.
 */
export function freeAnchoredStickies(file: SododeckFile): SododeckFile {
  if (!file.stickies.some((sticky) => sticky.anchor !== undefined)) return file;
  return {
    ...file,
    stickies: file.stickies.map((sticky) => {
      if (sticky.anchor === undefined) return sticky;
      const { anchor: _anchor, ...rest } = sticky;
      return { ...rest, position: legacyStickyPoint(file, sticky) };
    }),
  };
}
