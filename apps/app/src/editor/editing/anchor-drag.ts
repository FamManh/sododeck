/**
 * Sliding a connector's end along a card side (022 R4, frame 118 c). Pure: the pointer is
 * projected onto the nearest side of the card, snaps within 4 % to 0 / 25 / 50 / 75 / 100 %
 * (⌘ turns that off) and a drop deeper than 12 px inside every side means "automatic" again.
 * The canvas handler feeds it from the reconnect drag; keyboard steps use `stepAnchor`.
 */
import type { Side } from '@sododeck/schema';

import { anchorPoint } from '../routing/connector-geometry';
import { nearestSide, type Box, type Point } from '../routing/route-path';

/** The positions an end snaps to along a side. */
export const ANCHOR_STOPS = [0, 0.25, 0.5, 0.75, 1] as const;
/** Snapping reach, as a fraction of the side's length. */
export const ANCHOR_SNAP = 0.04;
/** A drop deeper than this inside every side clears the pinned side (back to automatic). */
export const BODY_DEPTH = 12;

export interface AnchorHit {
  side: Side;
  /** 0 to 1 along the side (left → right, top → bottom), after snapping. */
  at: number;
  /** Landed on one of the five stops. */
  snapped: boolean;
  /** Deeper than `BODY_DEPTH` inside the card: the end becomes automatic. */
  automatic: boolean;
  /** The anchor point on the card side, for the preview line. */
  point: Point;
}

/** How far a point is inside a box, to its nearest side (negative outside, 0 on a side). */
function depthIn(box: Box, p: Point): number {
  return Math.min(p.x - box.x, box.x + box.width - p.x, p.y - box.y, box.y + box.height - p.y);
}

export function anchorFromPoint(box: Box, pointer: Point, options: { mod: boolean }): AnchorHit {
  const side = nearestSide(box, pointer);
  const horizontal = side === 'top' || side === 'bottom';
  const raw = horizontal
    ? box.width === 0
      ? 0.5
      : (pointer.x - box.x) / box.width
    : box.height === 0
      ? 0.5
      : (pointer.y - box.y) / box.height;
  const clamped = Math.max(0, Math.min(1, raw));
  const stop = ANCHOR_STOPS.find((s) => Math.abs(s - clamped) <= ANCHOR_SNAP);
  const snapped = !options.mod && stop !== undefined;
  const at = snapped ? stop : Math.round(clamped * 1000) / 1000;
  return {
    side,
    at,
    snapped,
    automatic: depthIn(box, pointer) > BODY_DEPTH,
    point: anchorPoint(box, side, at),
  };
}

/** "left side · 78 %" (frame 118 c). */
export function anchorReadout(side: Side, at: number, snapped = false): string {
  return `${side} side · ${String(Math.round(at * 100))} %${snapped ? ' · snapped' : ''}`;
}

/** The corner a side's end meets, so a step can carry on along the neighbouring side. */
const CORNERS: Record<string, { side: Side; at: 0 | 1 }> = {
  'top:0': { side: 'left', at: 0 },
  'top:1': { side: 'right', at: 0 },
  'right:0': { side: 'top', at: 1 },
  'right:1': { side: 'bottom', at: 1 },
  'bottom:0': { side: 'left', at: 1 },
  'bottom:1': { side: 'right', at: 1 },
  'left:0': { side: 'top', at: 0 },
  'left:1': { side: 'bottom', at: 0 },
};

/**
 * One keyboard step along the side to the next snap stop (`direction` −1 toward the start of the
 * side, +1 toward its end). At a corner the end moves onto the neighbouring side.
 */
export function stepAnchor(side: Side, at: number, direction: -1 | 1): { side: Side; at: number } {
  const stops = ANCHOR_STOPS as readonly number[];
  const next =
    direction === 1
      ? stops.find((s) => s > at + 1e-9)
      : [...stops].reverse().find((s) => s < at - 1e-9);
  if (next !== undefined) return { side, at: next };
  const corner = CORNERS[`${side}:${direction === 1 ? '1' : '0'}`];
  return corner === undefined ? { side, at } : { side: corner.side, at: corner.at };
}
