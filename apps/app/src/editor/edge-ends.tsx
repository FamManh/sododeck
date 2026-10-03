import type { Direction } from '@sododeck/schema';

import { KNOB_RADIUS } from './edge-constants';
import { arrowPathAt, endMarks, type EndMark } from './edge-end-marks';
import type { PathEnds } from './routing/route-path';

interface EdgeEndsProps extends PathEnds {
  /** Absent means `forward`, as in the file format. */
  direction?: Direction | undefined;
  /** Mark colour; defaults to the inherited `currentColor`. */
  color?: string | undefined;
}

function Mark({ mark }: { mark: EndMark }) {
  if (mark.kind === 'knob') {
    return (
      <circle
        data-testid="edge-knob"
        aria-hidden="true"
        cx={mark.at.x}
        cy={mark.at.y}
        r={KNOB_RADIUS}
        fill="currentColor"
      />
    );
  }
  // Drawn as a path, not an SVG marker: the line colour changes per edge state (flow,
  // selection, dimming) and a marker would need one definition per colour.
  return (
    <path
      data-testid="edge-arrow"
      aria-hidden="true"
      d={arrowPathAt(mark.at.x, mark.at.y, mark.angle)}
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
export function EdgeEnds({ start, end, startDir, endDir, direction, color }: EdgeEndsProps) {
  return (
    <g style={color === undefined ? undefined : { color }}>
      {endMarks({ start, end, startDir, endDir }, direction).map((mark, index) => (
        <Mark key={index} mark={mark} />
      ))}
    </g>
  );
}
