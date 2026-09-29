/**
 * Distance and equal-gap labels shown with the snapping guides (016 R7). Pure.
 *
 * Axis 'x' measures horizontal gaps between cards in the same row (their vertical ranges
 * overlap); axis 'y' measures vertical gaps between cards in the same column.
 */
import type { Guide } from '../../state/ui-store';
import type { Point, Rect } from '../canvas-geometry';

export interface GapLabel {
  value: number;
  at: Point;
}

/** Equal within this many px (rounding of card positions makes exact equality rare). */
const EQUAL_TOLERANCE = 1;

interface Span {
  start: number;
  end: number;
}

function along(r: Rect, axis: 'x' | 'y'): Span {
  return axis === 'x' ? { start: r.x, end: r.x + r.width } : { start: r.y, end: r.y + r.height };
}

function across(r: Rect, axis: 'x' | 'y'): Span {
  return along(r, axis === 'x' ? 'y' : 'x');
}

interface Neighbour {
  rect: Rect;
  gap: number;
  label: GapLabel;
}

/** Nearest card in `box`'s row/column on one side (`after`: right/below), or null. */
function neighbour(
  box: Rect,
  others: readonly Rect[],
  axis: 'x' | 'y',
  after: boolean,
): Neighbour | null {
  const main = along(box, axis);
  const cross = across(box, axis);
  let best: Neighbour | null = null;
  for (const other of others) {
    const oCross = across(other, axis);
    const lo = Math.max(cross.start, oCross.start);
    const hi = Math.min(cross.end, oCross.end);
    if (hi - lo <= 0) continue;
    const oMain = along(other, axis);
    const gapStart = after ? main.end : oMain.end;
    const gapEnd = after ? oMain.start : main.start;
    const gap = gapEnd - gapStart;
    // Overlapping cards have no gap to show.
    if (gap < 0 || (best && gap >= best.gap)) continue;
    const mid = (gapStart + gapEnd) / 2;
    const crossMid = (lo + hi) / 2;
    best = {
      rect: other,
      gap,
      label: {
        value: Math.round(gap),
        at: axis === 'x' ? { x: mid, y: crossMid } : { x: crossMid, y: mid },
      },
    };
  }
  return best;
}

function nearest(box: Rect, others: readonly Rect[], axis: 'x' | 'y') {
  const before = neighbour(box, others, axis, false);
  const after = neighbour(box, others, axis, true);
  if (!before) return after ? { n: after, after: true } : null;
  if (!after) return { n: before, after: false };
  return after.gap < before.gap ? { n: after, after: true } : { n: before, after: false };
}

/**
 * Distance from `box` to its nearest neighbour on `axis` among cards in the same row (axis 'x':
 * vertical overlap) or column (axis 'y': horizontal overlap), with the label point halfway along
 * the gap. Null when there is no neighbour on that axis.
 */
export function nearestGap(box: Rect, others: readonly Rect[], axis: 'x' | 'y'): GapLabel | null {
  return nearest(box, others, axis)?.n.label ?? null;
}

/**
 * When the gap from `box` to its nearest neighbour equals (±1 px) the gap between that neighbour
 * and the next card beyond it in the same row/column, the labels of both gaps; otherwise [].
 */
export function equalGaps(box: Rect, others: readonly Rect[], axis: 'x' | 'y'): GapLabel[] {
  const first = nearest(box, others, axis);
  if (!first) return [];
  const rest = others.filter((o) => o !== first.n.rect);
  const second = neighbour(first.n.rect, rest, axis, first.after);
  if (!second || Math.abs(second.gap - first.n.gap) > EQUAL_TOLERANCE) return [];
  return [first.n.label, second.label];
}

/**
 * Adds `distance` / `equalGaps` to the guides of `box` (guide axis 'x' gets the horizontal-row gap
 * info, i.e. axis 'x' measurement), returning new guide objects.
 */
export function withGapLabels(
  guides: readonly Guide[],
  box: Rect,
  others: readonly Rect[],
): Guide[] {
  return guides.map((guide) => {
    const next: Guide = { ...guide };
    const distance = nearestGap(box, others, guide.axis);
    if (distance) next.distance = distance;
    const equal = equalGaps(box, others, guide.axis);
    if (equal.length > 0) next.equalGaps = equal;
    return next;
  });
}
