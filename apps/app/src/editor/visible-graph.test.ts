import { performance } from 'node:perf_hooks';

import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { generateBenchDeck } from '../bench/generate-deck';
import { deckOf } from '../test/render-canvas';
import { scopeBounds, scopeOf, validDrillDepth, visibleGraph } from './visible-graph';

describe('visibleGraph', () => {
  it('returns the unchanged top-level graph when nothing is collapsed', () => {
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'service', title: 'B', position: { x: 200, y: 0 }, group: 'g' },
      ],
      groups: [{ id: 'g', title: 'Core' }],
      edges: [{ id: 'e1', from: 'a', to: 'b' }],
    });

    expect(visibleGraph(deck, { node: null, group: null }, new Set())).toMatchObject({
      nodes: ['a', 'b'],
      groups: ['g'],
      cards: [],
      edges: ['e1'],
      merged: [],
      ports: [],
    });
  });

  it('merges collapsed-group edges and hides internal ones', () => {
    const deck = deckOf({
      nodes: [
        ...Array.from({ length: 3 }, (_, index) => ({
          id: `a${String(index)}`,
          type: 'service' as const,
          title: `A${String(index)}`,
          group: 'a',
          position: { x: index * 40, y: 0 },
        })),
        { id: 'b0', type: 'service' as const, title: 'B0', group: 'b', position: { x: 300, y: 0 } },
      ],
      groups: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ],
      edges: [
        ...Array.from({ length: 12 }, (_, index) => ({
          id: `ab${String(index)}`,
          from: `a${String(index % 3)}`,
          to: 'b0',
        })),
        { id: 'inside-a', from: 'a0', to: 'a1' },
      ],
    });

    const oneCollapsed = visibleGraph(deck, { node: null, group: null }, new Set(['a']));
    expect(oneCollapsed.cards).toMatchObject([
      { groupId: 'a', edgeCount: 1, hiddenEdges: ['inside-a'] },
    ]);
    expect(oneCollapsed.merged).toHaveLength(1);
    expect(oneCollapsed.merged[0]?.edgeIds).toEqual(
      Array.from({ length: 12 }, (_, index) => `ab${String(index)}`),
    );

    const bothCollapsed = visibleGraph(deck, { node: null, group: null }, new Set(['a', 'b']));
    expect(bothCollapsed.merged).toMatchObject([
      {
        a: 'collapsed:a',
        b: 'collapsed:b',
        edgeIds: Array.from({ length: 12 }, (_, index) => `ab${String(index)}`),
      },
    ]);
  });

  it('derives merged directions, including direction both', () => {
    const deck = deckOf({
      nodes: [
        { id: 'a1', type: 'service', title: 'A1', group: 'a' },
        { id: 'b1', type: 'service', title: 'B1', group: 'b' },
      ],
      groups: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ],
      edges: [
        { id: 'ab', from: 'a1', to: 'b1' },
        { id: 'ba', from: 'b1', to: 'a1' },
        { id: 'both', from: 'a1', to: 'b1', direction: 'both' },
      ],
    });
    const graph = visibleGraph(deck, { node: null, group: null }, new Set(['a']));
    expect(graph.merged[0]?.direction).toBe('both');
  });

  it('restores inner collapsed state after expanding an outer group', () => {
    const deck = deckOf({
      nodes: [{ id: 'n', type: 'service', title: 'N', group: 'inner' }],
      groups: [
        { id: 'outer', title: 'Outer' },
        { id: 'inner', title: 'Inner', parent: 'outer' },
      ],
    });

    const collapsed = new Set(['outer', 'inner']);
    expect(
      visibleGraph(deck, { node: null, group: null }, collapsed).cards.map((card) => card.groupId),
    ).toEqual(['outer']);
    expect(
      visibleGraph(deck, { node: null, group: null }, new Set(['inner'])).cards.map(
        (card) => card.groupId,
      ),
    ).toEqual(['inner']);
  });

  it('limits group scopes and creates one port pill per outside node', () => {
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'core' },
        { id: 'b', type: 'service', title: 'B', group: 'core' },
        { id: 'c', type: 'service', title: 'C' },
      ],
      groups: [{ id: 'core', title: 'Core' }],
      edges: [
        { id: 'ab', from: 'a', to: 'b' },
        { id: 'ac', from: 'a', to: 'c' },
        { id: 'bc', from: 'b', to: 'c' },
      ],
    });
    const graph = visibleGraph(deck, { node: null, group: 'core' }, new Set());
    expect(graph.nodes).toEqual(['a', 'b']);
    expect(graph.groups).toEqual([]);
    expect(graph.ports).toEqual([
      {
        id: 'port:c',
        outsideNodeId: 'c',
        outsideTitle: 'C',
        edgeIds: ['ac', 'bc'],
        insideNodeIds: ['a', 'b'],
      },
    ]);
  });

  it('shows children only in their parent scope and counts them', () => {
    const deck = deckOf({
      nodes: [
        { id: 'parent', type: 'service', title: 'Parent' },
        { id: 'child', type: 'service', title: 'Child', parent: 'parent' },
      ],
    });
    expect(visibleGraph(deck, { node: null, group: null }, new Set()).nodes).toEqual(['parent']);
    const scoped = visibleGraph(deck, { node: 'parent', group: null }, new Set());
    expect(scoped.nodes).toEqual(['child']);
    expect(scoped.childCount.get('parent')).toBe(1);
  });

  it('draws a group only when a visible member is in its subtree', () => {
    const deck = deckOf({
      nodes: [
        { id: 'child', type: 'service', title: 'Child', group: 'inner', parent: 'parent' },
        { id: 'parent', type: 'service', title: 'Parent' },
      ],
      groups: [
        { id: 'outer', title: 'Outer' },
        { id: 'inner', title: 'Inner', parent: 'outer' },
      ],
    });
    expect(visibleGraph(deck, { node: null, group: null }, new Set()).groups).toEqual([]);
    expect(visibleGraph(deck, { node: 'parent', group: null }, new Set()).groups).toEqual([
      'outer',
      'inner',
    ]);
  });

  it('ignores missing refs and parent cycles without throwing', () => {
    const deck = {
      ...emptySododeckFile(),
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'missing' } as const,
        { id: 'b', type: 'service', title: 'B', parent: 'c' } as const,
        { id: 'c', type: 'service', title: 'C', parent: 'b' } as const,
      ],
      groups: [{ id: 'g', title: 'G', parent: 'g' }],
    };
    expect(() => visibleGraph(deck, { node: null, group: null }, new Set(['g']))).not.toThrow();
    expect(visibleGraph(deck, { node: null, group: null }, new Set()).nodes).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('caches by deck arrays plus scope and collapsed ids', () => {
    const deck = deckOf({
      nodes: [{ id: 'a', type: 'service', title: 'A' }],
    });
    const scope = { node: null, group: null } as const;
    const collapsed = new Set<string>();
    expect(visibleGraph(deck, scope, collapsed)).toBe(visibleGraph(deck, scope, collapsed));
    expect(visibleGraph({ ...deck, name: 'Renamed' }, scope, collapsed)).toBe(
      visibleGraph(deck, scope, collapsed),
    );
  });

  it('maps drill frames to the active node and group scope', () => {
    expect(scopeOf([])).toEqual({ node: null, group: null });
    expect(
      scopeOf([
        { kind: 'group', id: 'g1' },
        { kind: 'group', id: 'g2' },
      ]),
    ).toEqual({
      node: null,
      group: 'g2',
    });
    expect(
      scopeOf([
        { kind: 'group', id: 'g1' },
        { kind: 'node', id: 'n1' },
        { kind: 'group', id: 'g2' },
      ]),
    ).toEqual({ node: 'n1', group: 'g2' });
  });

  it('boxes what is shown and validates drill depth', () => {
    const deck = deckOf({
      nodes: [
        { id: 'parent', type: 'service', title: 'Parent', position: { x: 0, y: 0 } },
        {
          id: 'child',
          type: 'service',
          title: 'Child',
          parent: 'parent',
          position: { x: 200, y: 100 },
        },
      ],
      groups: [{ id: 'core', title: 'Core' }],
    });
    const top = visibleGraph(deck, { node: null, group: null }, new Set());
    expect(scopeBounds(deck, top, 'system')).toEqual({ x: 0, y: 0, width: 164, height: 50 });
    expect(validDrillDepth(deck, [{ kind: 'node', id: 'parent' }])).toBe(1);
    expect(validDrillDepth(deck, [{ kind: 'node', id: 'missing' }])).toBe(0);
  });

  it('derives the grouped benchmark deck within the performance budget', () => {
    const { deck } = generateBenchDeck(500, 1000, 42, { groups: true });
    const runs = Array.from({ length: 20 }, () => {
      const start = performance.now();
      visibleGraph(deck, { node: null, group: null }, new Set(['g0', 'g5', 'g10', 'g15', 'g20']));
      return performance.now() - start;
    }).sort((a, b) => a - b);
    const median = runs[Math.floor(runs.length / 2)] ?? Infinity;
    if (median > 2) console.warn(`visibleGraph median ${median.toFixed(2)} ms exceeds soft target`);
    expect(median).toBeLessThan(10);
  });
});
