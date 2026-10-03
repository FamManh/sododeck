/**
 * Moving a connector's label along its line (022 R10). `labelAt` is a fraction of the drawn
 * line's length, so the label follows cards and bends. Pure: the pointer is projected onto the
 * sampled path, snaps within 4 % to the 25 / 50 / 75 % ticks (⌘ turns that off), and the pill
 * stays 8 px plus half its width away from each end so it never sits on a card.
 */
import { projectOnPath, type PathSamples } from '../routing/connector-geometry';
import type { Point } from '../routing/route-path';

/** The ticks drawn while dragging. */
export const LABEL_TICKS = [0.25, 0.5, 0.75] as const;
/** Snapping reach, as a fraction of the line's length. */
export const LABEL_SNAP = 0.04;
/** Keyboard step for ← / →. */
export const LABEL_STEP = 0.05;
/** Gap kept between the pill and a card, in px. */
export const LABEL_END_GAP = 8;

/** Estimated half width of a label pill (the export draws it measured; the canvas auto-sizes). */
export function labelHalfWidth(label: string | null, badges = 0): number {
  return ((label?.length ?? 0) * 6.3 + badges * 20 + 16) / 2;
}

/** Distance from each end of the line the pill's centre must keep, in px. */
export function labelClamp(label: string | null, badges = 0): number {
  return LABEL_END_GAP + labelHalfWidth(label, badges);
}

/** The reachable range of `labelAt` for a line of `total` px; a short line only allows 0.5. */
export function labelRange(total: number, clamp: number): { min: number; max: number } {
  if (total <= 0 || clamp * 2 >= total) return { min: 0.5, max: 0.5 };
  // Rounded inward so a stored value never lets the pill closer than the clamp.
  return {
    min: Math.ceil((clamp / total) * 1000) / 1000,
    max: Math.floor((1 - clamp / total) * 1000) / 1000,
  };
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

export interface LabelHit {
  at: number;
  snapped: boolean;
}

/** The fraction under the pointer, clamped to the reachable range, then snapped to a tick. */
export function labelFromPoint(
  samples: PathSamples,
  pointer: Point,
  clamp: number,
  options: { mod: boolean },
): LabelHit {
  const { min, max } = labelRange(samples.total, clamp);
  const raw = Math.max(min, Math.min(max, projectOnPath(samples, pointer)));
  const tick = LABEL_TICKS.find((t) => Math.abs(t - raw) <= LABEL_SNAP && t >= min && t <= max);
  if (!options.mod && tick !== undefined) return { at: tick, snapped: true };
  return { at: r3(raw), snapped: false };
}

/** "label 20 %" (+ " · snapped" on a tick). */
export function labelReadout(at: number, snapped = false): string {
  return `label ${String(Math.round(at * 100))} %${snapped ? ' · snapped' : ''}`;
}

/**
 * A key on the focused label: ← / → 5 %, Shift + ← / → the previous / next tick, Home / End the
 * clamped ends. Returns the new fraction, or null when the key means nothing here.
 */
export function stepLabel(
  at: number,
  key: string,
  shift: boolean,
  range: { min: number; max: number },
): number | null {
  const clampTo = (value: number) => r3(Math.max(range.min, Math.min(range.max, value)));
  switch (key) {
    case 'Home':
      return clampTo(0);
    case 'End':
      return clampTo(1);
    case 'ArrowLeft':
    case 'ArrowRight': {
      const forward = key === 'ArrowRight';
      if (shift) {
        const ticks = LABEL_TICKS.filter((t) => t >= range.min - 1e-9 && t <= range.max + 1e-9);
        const next = forward
          ? ticks.find((t) => t > at + 1e-9)
          : [...ticks].reverse().find((t) => t < at - 1e-9);
        return next === undefined ? clampTo(forward ? 1 : 0) : next;
      }
      return clampTo(at + (forward ? LABEL_STEP : -LABEL_STEP));
    }
    default:
      return null;
  }
}
