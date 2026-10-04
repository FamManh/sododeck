import type { Direction } from '@sododeck/schema';

import { CROW_RING, KNOB_RADIUS } from './edge-constants';
import {
  arrowPathAt,
  CROW_NAMES,
  crossPathAt,
  crowPath,
  endMarks,
  type ConnectorMark,
  type EndMark,
} from './edge-end-marks';
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

/**
 * A relationship's end marks (042 R7): crow's feet with a ring filled with the canvas colour, or
 * 1 / n text, in the line colour with round joins. Each is an `img` named by its meaning, so the
 * ends read without their shape.
 */
export function RelationshipEndMarks({
  marks,
  color,
  width,
}: {
  marks: readonly EndMark[];
  color: string;
  width: number | string;
}) {
  return (
    <g style={{ color }} data-testid="relationship-ends">
      {marks.map((mark, index) => {
        if (mark.kind === 'crow') {
          const crow = crowPath(mark.at, mark.u, mark.end);
          return (
            <g key={index} role="img" aria-label={CROW_NAMES[mark.end]} pointerEvents="none">
              <title>{CROW_NAMES[mark.end]}</title>
              {crow.d !== '' && (
                <path
                  d={crow.d}
                  fill="none"
                  stroke="currentColor"
                  style={{ strokeWidth: width }}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {crow.ring !== undefined && (
                <circle
                  cx={crow.ring.cx}
                  cy={crow.ring.cy}
                  r={CROW_RING}
                  fill="var(--color-canvas)"
                  stroke="currentColor"
                  style={{ strokeWidth: width }}
                />
              )}
            </g>
          );
        }
        if (mark.kind === 'card-text') {
          return (
            <text
              key={index}
              x={mark.at.x}
              y={mark.at.y}
              textAnchor={mark.anchor}
              dominantBaseline="middle"
              fill="currentColor"
              pointerEvents="none"
              className="font-mono text-[10.5px]"
            >
              {mark.text}
            </text>
          );
        }
        return null;
      })}
    </g>
  );
}
