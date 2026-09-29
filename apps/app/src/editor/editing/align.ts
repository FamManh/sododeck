/**
 * Align and distribute (016 R12, SC-004). Pure: works on the displayed card rects so the result
 * lines up with what the user sees at the current level.
 */
import type { Point, Rect } from '../canvas-geometry';

export interface IdRect extends Rect {
  id: string;
}

export type AlignMode = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

/** New top-left positions for the rects that move (unchanged ones may be omitted). */
export function align(rects: readonly IdRect[], mode: AlignMode): Record<string, Point> {
  if (rects.length < 2) return {};
  const left = Math.min(...rects.map((r) => r.x));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const top = Math.min(...rects.map((r) => r.y));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));

  const place = (r: IdRect): Point => {
    switch (mode) {
      case 'left':
        return { x: left, y: r.y };
      case 'right':
        return { x: right - r.width, y: r.y };
      case 'centre':
        return { x: (left + right) / 2 - r.width / 2, y: r.y };
      case 'top':
        return { x: r.x, y: top };
      case 'bottom':
        return { x: r.x, y: bottom - r.height };
      case 'middle':
        return { x: r.x, y: (top + bottom) / 2 - r.height / 2 };
    }
  };

  const out: Record<string, Point> = {};
  for (const r of rects) {
    const p = place(r);
    const next = { x: Math.round(p.x), y: Math.round(p.y) };
    if (next.x !== r.x || next.y !== r.y) out[r.id] = next;
  }
  return out;
}

/** Space-between on one axis: the outermost rects stay, the gaps between the others are equal. */
export function distribute(rects: readonly IdRect[], axis: DistributeAxis): Record<string, Point> {
  if (rects.length < 3) return {};
  const key = axis === 'horizontal' ? 'x' : 'y';
  const size = axis === 'horizontal' ? 'width' : 'height';
  const sorted = [...rects].sort((a, b) => a[key] - b[key] || (a.id < b.id ? -1 : 1));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return {};

  const total = sorted.reduce((sum, r) => sum + r[size], 0);
  // Gaps may be negative when the rects overlap; they are still equal.
  const gap = (last[key] + last[size] - first[key] - total) / (sorted.length - 1);

  const out: Record<string, Point> = {};
  // Accumulate the exact (unrounded) start so rounding errors never add up past 1 px.
  let cursor = first[key] + first[size] + gap;
  for (const r of sorted.slice(1, -1)) {
    const at = Math.round(cursor);
    if (at !== r[key]) out[r.id] = key === 'x' ? { x: at, y: r.y } : { x: r.x, y: at };
    cursor += r[size] + gap;
  }
  return out;
}
