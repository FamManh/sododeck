import type { Direction } from '@sododeck/schema';

import { ARROW_LENGTH, ARROW_WIDTH } from './edge-constants';
import type { PathEnds, Point } from './routing/route-path';

/** One end mark of a connector, in canvas coordinates. */
export type EndMark =
  | { kind: 'knob'; at: Point }
  | { kind: 'arrow'; at: Point; /** Degrees, the way the tip points. */ angle: number }
  /** The × that closes an error path (035): no direction, so no angle. */
  | { kind: 'cross'; at: Point };

/** The arrow's outline with its tip at the origin, pointing along +x. */
export const ARROW_PATH = `M 0 0 L -${String(ARROW_LENGTH)} -${String(ARROW_WIDTH / 2)} L -${String(ARROW_LENGTH)} ${String(ARROW_WIDTH / 2)} Z`;

/**
 * The arrow in canvas coordinates (tip at `x, y`, pointing `angle` degrees). Baked into the path
 * rather than placed with a `transform`: 1,000 rotated paths made panning and dragging 500 cards
 * drop from 60 to about 30 fps (029 T060 bench).
 */
export function arrowPathAt(x: number, y: number, angle: number): string {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const half = ARROW_WIDTH / 2;
  // Number() drops a stray "-0" and trailing zeros.
  const n = (value: number) => String(Number(value.toFixed(2)));
  const at = (back: number, side: number) =>
    `${n(x + cos * back - sin * side)} ${n(y + sin * back + cos * side)}`;
  return `M ${String(x)} ${String(y)} L ${at(-ARROW_LENGTH, -half)} L ${at(-ARROW_LENGTH, half)} Z`;
}

/** Half the width of the × that ends an error path. */
const CROSS_HALF = 5;

/** The × centred on `x, y`, as two strokes in one path (baked, like the arrow). */
export function crossPathAt(x: number, y: number): string {
  const [x1, x2, y1, y2] = [x - CROSS_HALF, x + CROSS_HALF, y - CROSS_HALF, y + CROSS_HALF];
  return `M ${String(x1)} ${String(y1)} L ${String(x2)} ${String(y2)} M ${String(x1)} ${String(y2)} L ${String(x2)} ${String(y1)}`;
}

/** Degrees, rounded so the attribute stays short and stable. */
function angle(dir: Point): number {
  return Math.round((Math.atan2(dir.y, dir.x) * 180) / Math.PI);
}

/**
 * The marks of a connector (029 R6): a knob at the start and an arrow at the end for `forward`,
 * arrows at both ends for `both`, knobs at both ends for `none`. Pure and free of the canvas
 * library, so the canvas (`EdgeEnds`) and the export draw the same marks.
 */
export function endMarks(
  ends: PathEnds,
  direction: Direction | undefined,
): Exclude<EndMark, { kind: 'cross' }>[];
/** With `errorEnd` (an error path, 035) the end is a × and never an arrow or a knob. */
export function endMarks(
  ends: PathEnds,
  direction: Direction | undefined,
  errorEnd: boolean,
): EndMark[];
export function endMarks(
  ends: PathEnds,
  direction: Direction | undefined,
  errorEnd = false,
): EndMark[] {
  const mode = direction ?? 'forward';
  const start: EndMark =
    mode === 'both'
      ? {
          kind: 'arrow',
          at: ends.start,
          angle: angle({ x: 0 - ends.startDir.x, y: 0 - ends.startDir.y }),
        }
      : { kind: 'knob', at: ends.start };
  const end: EndMark = errorEnd
    ? { kind: 'cross', at: ends.end }
    : mode === 'none'
      ? { kind: 'knob', at: ends.end }
      : { kind: 'arrow', at: ends.end, angle: angle(ends.endDir) };
  return [start, end];
}
