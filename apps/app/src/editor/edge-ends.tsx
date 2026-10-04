import type { Direction } from '@sododeck/schema';

import { KNOB_RADIUS } from './edge-constants';
import { arrowPathAt, crossPathAt, endMarks, type ConnectorMark } from './edge-end-marks';
import type { PathEnds } from './routing/route-path';

interface EdgeEndsProps extends PathEnds {
  /** Absent means `forward`, as in the file format. */
  direction?: Direction | undefined;
  /** Mark colour; defaults to the inherited `currentColor`. */
  color?: string | undefined;
  /** The connector is an error path (035): it ends in × instead of an arrow. */
  errorEnd?: boolean | undefined;
  /** Grows the knob and arrow with a heavier line (022, frame 133); 1 at the default weight. */
  scale?: number | undefined;
}

function Mark({ mark, scale }: { mark: ConnectorMark; scale: number }) {
  if (mark.kind === 'knob') {
    return (
      <circle
        data-testid="edge-knob"
        aria-hidden="true"
        cx={mark.at.x}
        cy={mark.at.y}
        r={KNOB_RADIUS * scale}
        fill="currentColor"
      />
    );
  }
  if (mark.kind === 'cross') {
    return (
      <path
        data-testid="edge-cross"
        aria-hidden="true"
        d={crossPathAt(mark.at.x, mark.at.y)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    );
  }
  // Drawn as a path, not an SVG marker: the line colour changes per edge state (flow,
  // selection, dimming) and a marker would need one definition per colour.
  return (
    <path
      data-testid="edge-arrow"
      aria-hidden="true"
      d={arrowPathAt(mark.at.x, mark.at.y, mark.angle, scale)}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
    />
  );
}

/**
 * The two end marks of a connector (029 R6), see `endMarks`. Pure SVG with no canvas-library
 * import.
 */
export function EdgeEnds({
  start,
  end,
  startDir,
  endDir,
  direction,
  color,
  errorEnd,
  scale = 1,
}: EdgeEndsProps) {
  return (
    <g style={color === undefined ? undefined : { color }}>
      {endMarks({ start, end, startDir, endDir }, direction, errorEnd === true).map(
        (mark, index) => (
          <Mark key={index} mark={mark} scale={scale} />
        ),
      )}
    </g>
  );
}
