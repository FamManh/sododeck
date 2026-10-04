import { describe, expect, it } from 'vitest';

import { elbowVertices } from './connector-geometry';
import { elbowRuns, runMidpoint } from './elbow-runs';

// A Z from a right side to a left side: out, across, in.
const z = elbowVertices(
  [
    { x: 0, y: 0 },
    { x: 200, y: 100 },
  ],
  { start: { x: 1, y: 0 }, end: { x: 1, y: 0 } },
);

describe('elbowRuns', () => {
  it('reads the runs of elbowVertices output with the exact axis it moves along', () => {
    expect(z).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
    expect(elbowRuns(z, 24, 1)).toEqual([
      { index: 0, axis: 'y', from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, kind: 'start' },
      { index: 1, axis: 'x', from: { x: 100, y: 0 }, to: { x: 100, y: 100 }, kind: 'inner' },
      { index: 2, axis: 'y', from: { x: 100, y: 100 }, to: { x: 200, y: 100 }, kind: 'end' },
    ]);
  });

  it('labels start, inner and end runs, and a lone run as start', () => {
    const steps = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
    ];
    expect(elbowRuns(steps, 24, 1).map((r) => r.kind)).toEqual(['start', 'inner', 'inner', 'end']);
    expect(
      elbowRuns(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        24,
        1,
      ),
    ).toEqual([{ index: 0, axis: 'y', from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, kind: 'start' }]);
  });

  it.each([
    [0.5, [0, 2]],
    [1, [0, 1, 2]],
    [2, [0, 1, 2]],
  ] as const)('omits runs under 24 screen px at zoom %s', (zoom, kept) => {
    // Run lengths 100, 30 and 60 canvas px.
    const v = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 30 },
      { x: 160, y: 30 },
    ];
    expect(elbowRuns(v, 24, zoom).map((r) => r.index)).toEqual(kept);
  });

  it('keeps indexes of the full run list when short runs are left out', () => {
    const v = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 10 },
      { x: 200, y: 10 },
    ];
    expect(elbowRuns(v, 24, 1).map((r) => [r.index, r.kind])).toEqual([
      [0, 'start'],
      [2, 'end'],
    ]);
  });

  it('skips diagonal pieces and needs two points', () => {
    expect(elbowRuns([{ x: 0, y: 0 }], 24, 1)).toEqual([]);
    expect(
      elbowRuns(
        [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        24,
        1,
      ),
    ).toEqual([]);
  });

  it('runMidpoint is where the handle sits', () => {
    const [run] = elbowRuns(z, 24, 1);
    expect(run === undefined ? null : runMidpoint(run)).toEqual({ x: 50, y: 0 });
  });
});
