/**
 * The straight runs of a drawn elbow connector (050 R7), for segment handles. Pure. A run is the
 * piece between two consecutive vertices of `elbowVertices`; it moves only along its normal, so
 * `axis` is the axis it moves on: a horizontal run moves on `y`, a vertical one on `x`.
 */
import type { Point } from './route-path';

export interface Run {
  /** Position in the full run list (vertex `index` → vertex `index + 1`), short runs included. */
  index: number;
  /** The axis the run moves along: `y` for a horizontal run, `x` for a vertical one. */
  axis: 'x' | 'y';
  from: Point;
  to: Point;
  /** `start` touches the source card, `end` the target card; a lone run is `start`. */
  kind: 'inner' | 'start' | 'end';
}

/**
 * Every axis-aligned run of `vertices` at least `minScreenLength` screen px long at `zoom`
 * (FR-004: shorter runs get no handle, so handles never overlap). Diagonal pieces are skipped.
 */
export function elbowRuns(
  vertices: readonly Point[],
  minScreenLength: number,
  zoom: number,
): Run[] {
  const runs: Run[] = [];
  const last = vertices.length - 2;
  for (let i = 0; i <= last; i += 1) {
    const from = vertices[i];
    const to = vertices[i + 1];
    if (from === undefined || to === undefined) continue;
    const horizontal = from.y === to.y;
    const vertical = from.x === to.x;
    // A diagonal piece, or a repeated point: no run.
    if (horizontal === vertical) continue;
    const length = horizontal ? Math.abs(to.x - from.x) : Math.abs(to.y - from.y);
    if (length * zoom < minScreenLength) continue;
    runs.push({
      index: i,
      axis: horizontal ? 'y' : 'x',
      from,
      to,
      kind: i === 0 ? 'start' : i === last ? 'end' : 'inner',
    });
  }
  return runs;
}

/** The middle of a run, where its handle sits. */
export function runMidpoint(run: Pick<Run, 'from' | 'to'>): Point {
  return { x: (run.from.x + run.to.x) / 2, y: (run.from.y + run.to.y) / 2 };
}
