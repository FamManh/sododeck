import type { Direction } from '@sododeck/schema';

import { ARROW_LENGTH, ARROW_WIDTH } from './edge-constants';
import type { PathEnds, Point } from './routing/route-path';

/** One end mark of a connector, in canvas coordinates. */
export type EndMark =
  | { kind: 'knob'; at: Point }
  | { kind: 'arrow'; at: Point; /** Degrees, the way the tip points. */ angle: number };

/** The arrow's outline with its tip at the origin, pointing along +x. */
export const ARROW_PATH = `M 0 0 L -${String(ARROW_LENGTH)} -${String(ARROW_WIDTH / 2)} L -${String(ARROW_LENGTH)} ${String(ARROW_WIDTH / 2)} Z`;

/** Degrees, rounded so the attribute stays short and stable. */
function angle(dir: Point): number {
  return Math.round((Math.atan2(dir.y, dir.x) * 180) / Math.PI);
}

/**
 * The marks of a connector (029 R6): a knob at the start and an arrow at the end for `forward`,
 * arrows at both ends for `both`, knobs at both ends for `none`. Pure and free of the canvas
 * library, so the canvas (`EdgeEnds`) and the export draw the same marks.
 */
export function endMarks(ends: PathEnds, direction: Direction | undefined): EndMark[] {
  const mode = direction ?? 'forward';
  const start: EndMark =
    mode === 'both'
      ? {
          kind: 'arrow',
          at: ends.start,
          angle: angle({ x: 0 - ends.startDir.x, y: 0 - ends.startDir.y }),
        }
      : { kind: 'knob', at: ends.start };
  const end: EndMark =
    mode === 'none'
      ? { kind: 'knob', at: ends.end }
      : { kind: 'arrow', at: ends.end, angle: angle(ends.endDir) };
  return [start, end];
}
