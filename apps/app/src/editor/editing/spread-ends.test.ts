import type { Side } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import type { Box } from '../routing/route-path';
import { spreadEnds, spreadEndsPlan, type SpreadEdge, type SpreadView } from './spread-ends';

const card: Box = { x: 0, y: 0, width: 200, height: 100 };
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** A card to the right of `c` at height `y`. */
const right = (y: number): Box => ({ x: 600, y, width: 100, height: 40 });

function edge(
  id: string,
  from: string,
  to: string,
  fromSide: Side,
  toSide: Side,
  extra: Partial<SpreadEdge> = {},
): SpreadEdge {
  return { id, from, to, fromSide, toSide, ...extra };
}

function view(edges: SpreadEdge[], boxes: Record<string, Box>): SpreadView {
  return { edges, boxes: new Map(Object.entries({ c: card, ...boxes })) };
}

describe('spreadEnds', () => {
  it('spaces 10 ends on one side at (i+1)/11, ordered by the other end', () => {
    // Other cards at shuffled heights: rank by y decides the order.
    const heights = [500, 100, 900, 0, 300, 800, 200, 700, 400, 600];
    const boxes: Record<string, Box> = {};
    const edges = heights.map((y, i) => {
      boxes[`n${String(i)}`] = right(y);
      return edge(`e${String(i)}`, 'c', `n${String(i)}`, 'right', 'left');
    });
    const result = spreadEnds(view(edges, boxes), ['c']);
    const sorted = [...heights].sort((a, b) => a - b);
    expect(result).toHaveLength(10);
    for (const [i, y] of heights.entries()) {
      const rank = sorted.indexOf(y);
      expect(result.find((p) => p.edgeId === `e${String(i)}`)?.patch).toEqual({
        fromSide: 'right',
        fromAt: r4((rank + 1) / 11),
      });
    }
  });

  it('breaks ties by edge id', () => {
    const result = spreadEnds(
      view([edge('b', 'c', 'n1', 'right', 'left'), edge('a', 'c', 'n2', 'right', 'left')], {
        n1: right(100),
        n2: right(100),
      }),
      ['c'],
    );
    expect(result).toEqual([
      { edgeId: 'a', patch: { fromSide: 'right', fromAt: r4(1 / 3) } },
      { edgeId: 'b', patch: { fromSide: 'right', fromAt: r4(2 / 3) } },
    ]);
  });

  it('uses where the other end sits on its side, not only its card', () => {
    // Same card, but the anchors put e1 above e2.
    const result = spreadEnds(
      view(
        [
          edge('e1', 'c', 'n', 'right', 'left', { route: { toAt: 0.1 } }),
          edge('e2', 'c', 'n', 'right', 'bottom'),
        ],
        { n: right(100) },
      ),
      ['c'],
    );
    expect(result.map((p) => [p.edgeId, p.patch.fromAt])).toEqual([
      ['e1', r4(1 / 3)],
      ['e2', r4(2 / 3)],
    ]);
  });

  it('includes automatic ends at their resolved side and pins it; incoming ends set toAt', () => {
    const result = spreadEnds(
      view(
        [
          edge('in', 'n1', 'c', 'left', 'right'),
          edge('out', 'c', 'n2', 'right', 'left', { route: { fromAt: 0.9 } }),
        ],
        { n1: right(0), n2: right(300) },
      ),
      ['c'],
    );
    expect(result).toEqual([
      { edgeId: 'in', patch: { toSide: 'right', toAt: r4(1 / 3) } },
      { edgeId: 'out', patch: { fromSide: 'right', fromAt: r4(2 / 3) } },
    ]);
  });

  it('skips sides with fewer than two ends', () => {
    const plan = spreadEndsPlan(
      view(
        [
          edge('r1', 'c', 'n1', 'right', 'left'),
          edge('r2', 'c', 'n2', 'right', 'left'),
          edge('t', 'c', 'n3', 'top', 'bottom'),
        ],
        { n1: right(0), n2: right(200), n3: { x: 0, y: -300, width: 100, height: 40 } },
      ),
      ['c'],
    );
    expect(plan.patches.map((p) => p.edgeId)).toEqual(['r1', 'r2']);
    expect(plan.ends).toBe(2);
    expect(plan.sides).toBe(1);
  });

  it('counts both ends of a self-loop', () => {
    const plan = spreadEndsPlan(
      view(
        [
          edge('loop', 'c', 'c', 'right', 'bottom'),
          edge('r', 'c', 'n1', 'right', 'left'),
          edge('b', 'c', 'n2', 'bottom', 'top'),
        ],
        { n1: right(-500), n2: { x: 500, y: 400, width: 100, height: 40 } },
      ),
      ['c'],
    );
    // Right side: r's other end (y -480) comes before the loop's other end (bottom, y 100).
    // Bottom side: the loop's other end (right side, x 200) comes before b's (x 550).
    expect(plan.patches).toEqual([
      { edgeId: 'b', patch: { fromSide: 'bottom', fromAt: r4(2 / 3) } },
      {
        edgeId: 'loop',
        patch: { fromSide: 'right', fromAt: r4(2 / 3), toSide: 'bottom', toAt: r4(1 / 3) },
      },
      { edgeId: 'r', patch: { fromSide: 'right', fromAt: r4(1 / 3) } },
    ]);
    expect(plan.ends).toBe(4);
    expect(plan.sides).toBe(2);
  });

  it('skips connectors hidden in the view', () => {
    const result = spreadEnds(
      view(
        [
          edge('a', 'c', 'n1', 'right', 'left'),
          edge('h', 'c', 'n2', 'right', 'left', { hidden: true }),
        ],
        { n1: right(0), n2: right(200) },
      ),
      ['c'],
    );
    expect(result).toEqual([]);
  });

  it('works with group ends, on either side of the connector', () => {
    const group: Box = { x: 600, y: -100, width: 400, height: 400 };
    const v = view(
      [
        edge('a', 'c', 'g', 'right', 'left'),
        edge('b', 'n1', 'g', 'right', 'left'),
        edge('d', 'c', 'n2', 'right', 'left'),
      ],
      { g: group, n1: right(500), n2: right(500) },
    );
    expect(spreadEnds(v, ['c'])).toEqual([
      { edgeId: 'a', patch: { fromSide: 'right', fromAt: r4(1 / 3) } },
      { edgeId: 'd', patch: { fromSide: 'right', fromAt: r4(2 / 3) } },
    ]);
    // The group's own left side: c (y 50) before n1 (y 520).
    expect(spreadEnds(v, ['g'])).toEqual([
      { edgeId: 'a', patch: { toSide: 'left', toAt: r4(1 / 3) } },
      { edgeId: 'b', patch: { toSide: 'left', toAt: r4(2 / 3) } },
    ]);
  });

  it('skips ends whose box is not drawn', () => {
    expect(
      spreadEnds(
        view([edge('a', 'c', 'x', 'right', 'left'), edge('b', 'c', 'y', 'right', 'left')], {}),
        ['c'],
      ),
    ).toEqual([]);
  });

  it('gives the same output for the same input, whatever the edge or card order', () => {
    const boxes = { n1: right(0), n2: right(200), n3: right(400) };
    const edges = [
      edge('e3', 'c', 'n3', 'right', 'left'),
      edge('e1', 'c', 'n1', 'right', 'left'),
      edge('e2', 'n2', 'c', 'left', 'right'),
    ];
    const first = spreadEnds(view(edges, boxes), ['c', 'c']);
    expect(spreadEnds(view(edges, boxes), ['c'])).toEqual(first);
    expect(spreadEnds(view([...edges].reverse(), boxes), ['c'])).toEqual(first);
  });
});
