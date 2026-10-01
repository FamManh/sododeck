/**
 * Snapping of a dragged box to the lines of the other on-screen cards (016 R7, 017 R4). Pure; one
 * pass over the candidates per call, so it stays cheap at pointer-move rate.
 */
import type { Guide } from '../../state/ui-store';
import type { Rect } from '../canvas-geometry';
import type { Handle } from './resize-limits';

/** A line a box can snap to. `from`/`to`: the candidate card's span on the other axis. */
export interface SnapLine {
  at: number;
  from: number;
  to: number;
}

export interface SnapCandidates {
  x: readonly SnapLine[];
  y: readonly SnapLine[];
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

/** Lines closer than this count as the same line when spanning a guide. */
const SAME_LINE = 0.5;

/** Candidate lines of the non-dragged, on-screen cards: left, centre, right x; top, middle, bottom y. */
export function snapCandidates(rects: readonly Rect[]): SnapCandidates {
  const x: SnapLine[] = [];
  const y: SnapLine[] = [];
  for (const r of rects) {
    const vertical = { from: r.y, to: r.y + r.height };
    const horizontal = { from: r.x, to: r.x + r.width };
    x.push(
      { at: r.x, ...vertical },
      { at: r.x + r.width / 2, ...vertical },
      { at: r.x + r.width, ...vertical },
    );
    y.push(
      { at: r.y, ...horizontal },
      { at: r.y + r.height / 2, ...horizontal },
      { at: r.y + r.height, ...horizontal },
    );
  }
  return { x, y };
}

function snapAxis(
  lines: readonly number[],
  candidates: readonly SnapLine[],
  threshold: number,
): { offset: number; at: number } | null {
  let best: { offset: number; at: number } | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    for (const line of lines) {
      const distance = Math.abs(candidate.at - line);
      // Strictly smaller: ties keep the earlier candidate, then the earlier box line.
      if (distance <= threshold && distance < bestDistance) {
        bestDistance = distance;
        best = { offset: candidate.at - line, at: candidate.at };
      }
    }
  }
  return best;
}

function guideFor(
  axis: 'x' | 'y',
  at: number,
  span: { from: number; to: number },
  candidates: readonly SnapLine[],
): Guide {
  let { from, to } = span;
  for (const c of candidates) {
    if (Math.abs(c.at - at) <= SAME_LINE) {
      from = Math.min(from, c.from);
      to = Math.max(to, c.to);
    }
  }
  return { axis, at, from, to };
}

/** Snaps a moving box (the dragged selection's union box). threshold = 6 / zoom, passed in. */
export function snap(box: Rect, candidates: SnapCandidates, threshold: number): SnapResult {
  const x = snapAxis([box.x, box.x + box.width / 2, box.x + box.width], candidates.x, threshold);
  const y = snapAxis([box.y, box.y + box.height / 2, box.y + box.height], candidates.y, threshold);
  const dx = x?.offset ?? 0;
  const dy = y?.offset ?? 0;
  const guides: Guide[] = [];
  if (x) {
    guides.push(
      guideFor('x', x.at, { from: box.y + dy, to: box.y + dy + box.height }, candidates.x),
    );
  }
  if (y) {
    guides.push(
      guideFor('y', y.at, { from: box.x + dx, to: box.x + dx + box.width }, candidates.y),
    );
  }
  return { dx, dy, guides };
}

export interface EdgeSnapResult {
  box: Rect;
  guides: Guide[];
}

export interface SegmentSnapResult {
  at: number;
  guides: Guide[];
}

/**
 * Snaps a connector's movable middle segment (017 R7): only its own moving axis may snap, to the
 * candidates' left/centre/right or top/middle/bottom lines, spanning the segment's fixed extent.
 */
export function snapSegment(
  at: number,
  axis: 'vertical' | 'horizontal',
  span: { from: number; to: number },
  candidates: SnapCandidates,
  threshold: number,
): SegmentSnapResult {
  const lines = axis === 'vertical' ? candidates.y : candidates.x;
  const hit = snapAxis([at], lines, threshold);
  if (hit === null) return { at, guides: [] };
  return { at: hit.at, guides: [guideFor(axis === 'vertical' ? 'y' : 'x', hit.at, span, lines)] };
}

/**
 * Snaps a card resize (017 R4): only the edge(s) the handle actually drags may snap, to the
 * candidates' own left/centre/right or top/middle/bottom lines — never the box's centre, and
 * never the edge that stayed put.
 */
export function snapEdges(
  box: Rect,
  handle: Handle,
  candidates: SnapCandidates,
  threshold: number,
): EdgeSnapResult {
  let { x, y, width, height } = box;
  const guides: Guide[] = [];

  if (handle.includes('left')) {
    const hit = snapAxis([x], candidates.x, threshold);
    if (hit) {
      width += x - hit.at;
      x = hit.at;
      guides.push(guideFor('x', hit.at, { from: y, to: y + height }, candidates.x));
    }
  } else if (handle.includes('right')) {
    const hit = snapAxis([x + width], candidates.x, threshold);
    if (hit) {
      width = hit.at - x;
      guides.push(guideFor('x', hit.at, { from: y, to: y + height }, candidates.x));
    }
  }

  if (handle.includes('top')) {
    const hit = snapAxis([y], candidates.y, threshold);
    if (hit) {
      height += y - hit.at;
      y = hit.at;
      guides.push(guideFor('y', hit.at, { from: x, to: x + width }, candidates.y));
    }
  } else if (handle.includes('bottom')) {
    const hit = snapAxis([y + height], candidates.y, threshold);
    if (hit) {
      height = hit.at - y;
      guides.push(guideFor('y', hit.at, { from: x, to: x + width }, candidates.y));
    }
  }

  return { box: { x, y, width, height }, guides };
}
