import { describe, expect, it } from 'vitest';

import { deckOf } from '../test/render-canvas';
import { BUNDLE_EDGE_PREFIX, bundleEdges, bundleOptions } from './bundles';
import { visibleGraph } from './visible-graph';

const NONE = new Set<string>();
const options = { exclude: NONE, fanned: NONE, off: false };
const top = { node: null, group: null };

const nodes = [
  { id: 'a', type: 'service', title: 'A' },
  { id: 'b', type: 'service', title: 'B' },
  { id: 'c', type: 'service', title: 'C' },
] as const;

function graphOf(deck: ReturnType<typeof deckOf>, collapsed: string[] = []) {
  return visibleGraph(deck, top, new Set(collapsed));
}

describe('bundleEdges (034 R4)', () => {
  it('folds two or more connectors between the same two cards, in either direction', () => {
    const deck = deckOf({
      nodes: [...nodes],
      edges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'b', to: 'a' },
        { id: 'e3', from: 'a', to: 'b' },
        { id: 'e4', from: 'a', to: 'c' },
      ],
    });
    const result = bundleEdges(deck, graphOf(deck), options);
    expect(BUNDLE_EDGE_PREFIX).toBe('bundle:');
    expect(result.bundles).toEqual([
      {
        id: 'bundle:a|b',
        a: 'a',
        b: 'b',
        edgeIds: ['e1', 'e2', 'e3'],
        direction: 'both',
        fanned: false,
      },
    ]);
    expect(result.plain).toEqual([{ edgeId: 'e4' }]);
  });

  it('reports a one-way bundle with the direction of its connectors', () => {
    const deck = deckOf({
      nodes: [...nodes],
      edges: [
        { id: 'e1', from: 'b', to: 'a' },
        { id: 'e2', from: 'b', to: 'a' },
        { id: 'e3', from: 'a', to: 'c' },
        { id: 'e4', from: 'a', to: 'c', direction: 'both' },
      ],
    });
    const { bundles } = bundleEdges(deck, graphOf(deck), options);
    expect(bundles.find((b) => b.id === 'bundle:a|b')?.direction).toBe('b-to-a');
    expect(bundles.find((b) => b.id === 'bundle:a|c')?.direction).toBe('both');
  });

  it('leaves a single connector, self-loops and own-route connectors plain', () => {
    const deck = deckOf({
      nodes: [...nodes],
      edges: [
        { id: 'solo', from: 'a', to: 'c' },
        { id: 'loop1', from: 'a', to: 'a' },
        { id: 'loop2', from: 'a', to: 'a' },
        { id: 'r1', from: 'a', to: 'b', route: { offset: 20 } },
        { id: 'r2', from: 'a', to: 'b', route: { fromSide: 'top' } },
        { id: 'p1', from: 'a', to: 'b' },
      ],
    });
    const result = bundleEdges(deck, graphOf(deck), options);
    expect(result.bundles).toEqual([]);
    expect(result.plain.map((p) => p.edgeId)).toEqual(['solo', 'r1', 'r2', 'p1']);
    // Self-loops never reach the visible graph, so they cannot join a bundle either.
    expect(result.plain.map((p) => p.edgeId)).not.toContain('loop1');
  });

  it('keeps an own-route connector out while the automatic ones around it still fold', () => {
    const deck = deckOf({
      nodes: [...nodes],
      edges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'b' },
        { id: 'adj', from: 'a', to: 'b', route: { offset: 30 } },
      ],
    });
    const result = bundleEdges(deck, graphOf(deck), options);
    expect(result.bundles[0]?.edgeIds).toEqual(['e1', 'e2']);
    expect(result.plain).toEqual([{ edgeId: 'adj' }]);
  });

  it('re-bundles the rest of a pair when a connector is excluded, or turns plain at one', () => {
    const deck = deckOf({
      nodes: [...nodes],
      edges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'b' },
        { id: 'e3', from: 'a', to: 'b' },
      ],
    });
    const graph = graphOf(deck);
    const one = bundleEdges(deck, graph, { ...options, exclude: new Set(['e2']) });
    expect(one.bundles[0]?.edgeIds).toEqual(['e1', 'e3']);
    expect(one.plain).toEqual([{ edgeId: 'e2' }]);
    const two = bundleEdges(deck, graph, { ...options, exclude: new Set(['e1', 'e2']) });
    expect(two.bundles).toEqual([]);
    expect(two.plain.map((p) => p.edgeId)).toEqual(['e1', 'e2', 'e3']);
  });

  it('bundles nothing when off', () => {
    const deck = deckOf({
      nodes: [...nodes],
      edges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'b' },
      ],
    });
    const result = bundleEdges(deck, graphOf(deck), { ...options, off: true });
    expect(result.bundles).toEqual([]);
    expect(result.plain.map((p) => p.edgeId)).toEqual(['e1', 'e2']);
  });

  it('returns a fanned bundle as plain connectors with their spread slots, and still lists it', () => {
    const deck = deckOf({
      nodes: [...nodes],
      edges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'b' },
        { id: 'e3', from: 'a', to: 'b' },
      ],
    });
    const result = bundleEdges(deck, graphOf(deck), {
      ...options,
      fanned: new Set(['bundle:a|b']),
    });
    expect(result.bundles).toHaveLength(1);
    expect(result.bundles[0]).toMatchObject({ id: 'bundle:a|b', fanned: true });
    expect(result.plain).toEqual([
      { edgeId: 'e1', fanIndex: 0, fanCount: 3 },
      { edgeId: 'e2', fanIndex: 1, fanCount: 3 },
      { edgeId: 'e3', fanIndex: 2, fanCount: 3 },
    ]);
  });

  it('resolves ends through collapsed groups (merged connectors stay untouched)', () => {
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'core' },
        { id: 'b', type: 'service', title: 'B', group: 'core' },
        { id: 'c', type: 'service', title: 'C' },
        { id: 'd', type: 'service', title: 'D' },
      ],
      groups: [{ id: 'core', title: 'Core' }],
      edges: [
        { id: 'ac', from: 'a', to: 'c' },
        { id: 'bc', from: 'b', to: 'c' },
        { id: 'cd1', from: 'c', to: 'd' },
        { id: 'cd2', from: 'c', to: 'd' },
      ],
    });
    const graph = graphOf(deck, ['core']);
    const result = bundleEdges(deck, graph, options);
    expect(graph.merged).toHaveLength(1);
    expect(result.bundles.map((b) => b.id)).toEqual(['bundle:c|d']);
    expect(result.plain).toEqual([]);
  });

  it('bundles port connectors between an inside card and an outside proxy', () => {
    const deck = deckOf({
      nodes: [
        { id: 'in', type: 'service', title: 'In', group: 'core' },
        { id: 'out', type: 'service', title: 'Out' },
        { id: 'out2', type: 'service', title: 'Out 2' },
      ],
      groups: [{ id: 'core', title: 'Core' }],
      edges: [
        { id: 'p1', from: 'out', to: 'in' },
        { id: 'p2', from: 'in', to: 'out' },
        { id: 'p3', from: 'out2', to: 'in' },
      ],
    });
    const graph = visibleGraph(deck, { node: null, group: 'core' }, new Set());
    const result = bundleEdges(deck, graph, options);
    expect(result.bundles).toEqual([
      {
        id: 'bundle:in|port:out',
        a: 'in',
        b: 'port:out',
        edgeIds: ['p1', 'p2'],
        direction: 'both',
        fanned: false,
      },
    ]);
    expect(result.plain).toEqual([{ edgeId: 'p3' }]);
  });

  it('sorts the pair so the id does not depend on direction', () => {
    const deck = deckOf({
      nodes: [...nodes],
      edges: [
        { id: 'e1', from: 'b', to: 'a' },
        { id: 'e2', from: 'b', to: 'a' },
      ],
    });
    expect(bundleEdges(deck, graphOf(deck), options).bundles[0]).toMatchObject({
      id: 'bundle:a|b',
      a: 'a',
      b: 'b',
    });
  });

  it('returns the same object for equal inputs', () => {
    const deck = deckOf({
      nodes: [...nodes],
      edges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'b' },
      ],
    });
    const graph = graphOf(deck);
    const first = bundleEdges(deck, graph, options);
    expect(bundleEdges(deck, graph, { exclude: new Set(), fanned: new Set(), off: false })).toBe(
      first,
    );
    expect(bundleEdges(deck, graph, { ...options, off: true })).not.toBe(first);
  });

  it('is fast at 500 cards / 1,000 connectors', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({
      id: `n${String(i)}`,
      type: 'service' as const,
      title: `N${String(i)}`,
    }));
    const deck = deckOf({
      nodes: many,
      edges: Array.from({ length: 1000 }, (_, i) => ({
        id: `e${String(i)}`,
        from: `n${String(i % 500)}`,
        to: `n${String((i * 7 + 1) % 500)}`,
      })),
    });
    const graph = graphOf(deck);
    const start = performance.now();
    bundleEdges(deck, graph, options);
    const ms = performance.now() - start;
    console.info(`bundleEdges 500/1000: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThan(50);
  });
});

describe('bundleOptions (034 R5)', () => {
  const deck = deckOf({
    nodes: [...nodes],
    edges: [
      { id: 'e1', from: 'a', to: 'b' },
      { id: 'e2', from: 'a', to: 'b' },
      { id: 'e3', from: 'a', to: 'b' },
    ],
  });
  const graph = graphOf(deck);

  it("takes the shown flow's marked connectors out and re-bundles the rest", () => {
    const shown = bundleOptions({ shown: true, recording: false, markedEdges: ['e2'] }, NONE);
    const result = bundleEdges(deck, graph, shown);
    expect(result.bundles[0]?.edgeIds).toEqual(['e1', 'e3']);
    expect(result.plain).toEqual([{ edgeId: 'e2' }]);
    const closed = bundleOptions({ shown: false, recording: false, markedEdges: ['e2'] }, NONE);
    expect(bundleEdges(deck, graph, closed).bundles[0]?.edgeIds).toEqual(['e1', 'e2', 'e3']);
  });

  it('turns bundling off while recording', () => {
    const recording = bundleOptions({ shown: true, recording: true, markedEdges: ['e2'] }, NONE);
    expect(recording.off).toBe(true);
    expect(bundleEdges(deck, graph, recording).bundles).toEqual([]);
  });
});
