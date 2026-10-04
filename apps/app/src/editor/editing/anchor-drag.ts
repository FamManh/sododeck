/**
 * Connector end positions along a card side (022 R4, frame 118 c): the keyboard stops
 * (0 / 25 / 50 / 75 / 100 %) that arrows step through, and the readout. Pointer drags attach ends
 * continuously along the outline instead (`routing/outline-attach.ts`, 050 R5).
 */
import type { Side } from '@sododeck/schema';

/** The positions an arrow key steps an end to along a side. */
export const ANCHOR_STOPS = [0, 0.25, 0.5, 0.75, 1] as const;

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
