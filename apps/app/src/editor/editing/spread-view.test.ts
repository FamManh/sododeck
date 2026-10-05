import { describe, expect, it } from 'vitest';

import { spreadTargets, spreadViewOf, type DrawnEdge, type DrawnNode } from './spread-view';

const node = (id: string, x: number, y: number, extra: Partial<DrawnNode> = {}): DrawnNode => ({
  id,
  position: { x, y },
  width: 100,
  height: 50,
  ...extra,
});

const edge = (
  id: string,
  source: string,
  target: string,
  sides: [string, string] = ['right', 'left'],
  extra: Partial<DrawnEdge> = {},
): DrawnEdge => ({
  id,
  type: 'deck',
  source,
  target,
  sourceHandle: sides[0],
  targetHandle: sides[1],
  ...extra,
});

describe('spreadViewOf (050 US7)', () => {
  it('takes boxes from the drawn nodes and sides from the drawn handles', () => {
    const view = spreadViewOf(
      [
        node('a', 0, 0),
        node('b', 300, 0, { width: undefined, measured: { width: 80, height: 40 } }),
      ],
      [edge('e1', 'a', 'b', ['bottom', 'top'])],
      [{ id: 'e1', route: { fromAt: 0.3 } }],
    );
    expect(view.boxes.get('a')).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    expect(view.boxes.get('b')).toEqual({ x: 300, y: 0, width: 80, height: 50 });
    expect(view.edges).toEqual([
      {
        id: 'e1',
        from: 'a',
        to: 'b',
        fromSide: 'bottom',
        toSide: 'top',
        route: { fromAt: 0.3 },
        hidden: false,
      },
    ]);
  });

  it('keeps group frames and collapsed cards under their drawn ids', () => {
    const view = spreadViewOf(
      [node('group:g', 0, 0, { width: 400, height: 300 }), node('a', 600, 0)],
      [edge('e1', 'group:g', 'a')],
      [{ id: 'e1' }],
    );
    expect(view.boxes.get('group:g')).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    expect(view.edges[0]?.from).toBe('group:g');
  });

  it('marks hidden and unroutable connectors hidden, and leaves out hidden or unsized nodes', () => {
    const view = spreadViewOf(
      [
        node('a', 0, 0),
        node('b', 300, 0, { hidden: true }),
        node('c', 0, 300, { width: undefined }),
      ],
      [
        edge('e1', 'a', 'b', ['right', 'left'], { hidden: true }),
        edge('e2', 'a', 'b', ['right', 'left'], { data: { routable: false } }),
      ],
      [{ id: 'e1' }, { id: 'e2' }],
    );
    expect(view.edges.map((e) => e.hidden)).toEqual([true, true]);
    expect(view.boxes.has('b')).toBe(false);
    expect(view.boxes.has('c')).toBe(false);
  });

  it('skips bundles, other edge types, stale ids and handles that are not sides', () => {
    const view = spreadViewOf(
      [node('a', 0, 0), node('b', 300, 0)],
      [
        edge('merged:x', 'a', 'b', ['right', 'left'], { type: 'merged' }),
        edge('leader', 'a', 'b', ['right', 'left'], { type: 'sticky-leader' }),
        edge('gone', 'a', 'b'),
        edge('e1', 'a', 'b', ['middle', 'left']),
        edge('e2', 'a', 'b', ['right', 'left'], { sourceHandle: null }),
      ],
      [{ id: 'merged:x' }, { id: 'leader' }, { id: 'e1' }, { id: 'e2' }],
    );
    expect(view.edges).toEqual([]);
  });
});

describe('spreadTargets', () => {
  it('names selected cards, and each selected group by its frame and its collapsed card', () => {
    expect(spreadTargets({ nodes: ['a', 'b'], groups: ['g'] })).toEqual([
      'a',
      'b',
      'group:g',
      'collapsed:g',
    ]);
  });
});
