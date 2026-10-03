import type { Direction } from '@sododeck/schema';

import { ARROW_LENGTH, ARROW_WIDTH, KNOB_RADIUS } from './edge-constants';
import type { PathEnds, Point } from './routing/route-path';

interface EdgeEndsProps extends PathEnds {
  /** Absent means `forward`, as in the file format. */
  direction?: Direction | undefined;
  /** Mark colour; defaults to the inherited `currentColor`. */
  color?: string | undefined;
}

/** Degrees, rounded so the attribute stays short and stable. */
function angle(dir: Point): number {
  return Math.round((Math.atan2(dir.y, dir.x) * 180) / Math.PI);
}

function Arrow({ at, dir }: { at: Point; dir: Point }) {
  // Drawn as a path, not an SVG marker: the line colour changes per edge state (flow,
  // selection, dimming) and a marker would need one definition per colour.
  const half = ARROW_WIDTH / 2;
  return (
    <path
      data-testid="edge-arrow"
      aria-hidden="true"
      d={`M 0 0 L -${String(ARROW_LENGTH)} -${String(half)} L -${String(ARROW_LENGTH)} ${String(half)} Z`}
      transform={`translate(${String(at.x)} ${String(at.y)}) rotate(${String(angle(dir))})`}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
    />
  );
}

function Knob({ at }: { at: Point }) {
  return (
    <circle
      data-testid="edge-knob"
      aria-hidden="true"
      cx={at.x}
      cy={at.y}
      r={KNOB_RADIUS}
      fill="currentColor"
    />
  );
}

/**
 * The two end marks of a connector (029 R6): a knob at the start and an arrow at the end for
 * `forward`, arrows at both ends for `both`, knobs at both ends for `none`. Pure SVG with no
 * canvas-library import, so the export draws the same marks.
 */
export function EdgeEnds({ start, end, startDir, endDir, direction, color }: EdgeEndsProps) {
  const mode = direction ?? 'forward';
  return (
    <g style={color === undefined ? undefined : { color }}>
      {mode === 'both' ? (
        <Arrow at={start} dir={{ x: 0 - startDir.x, y: 0 - startDir.y }} />
      ) : (
        <Knob at={start} />
      )}
      {mode === 'none' ? <Knob at={end} /> : <Arrow at={end} dir={endDir} />}
    </g>
  );
}
