import { describe, expect, it } from 'vitest';

import { deckOf } from '../test/render-canvas';
import { PROXY_GAP, PROXY_OFFSET, PROXY_SIZE, proxyLayout } from './proxy-layout';
import { scopeBounds, visibleGraph } from './visible-graph';

const inside = (id: string, y: number) => ({
  id,
  type: 'service' as const,
  title: id,
  group: 'core',
  position: { x: 100, y },
});
const outside = (id: string, type: 'database' | 'queue' | 'service' = 'service') => ({
  id,
  type,
  title: `Out ${id}`,
  position: { x: 900, y: 0 },
});

function layout(
  nodes: NonNullable<Parameters<typeof deckOf>[0]['nodes']>,
  edges: { id: string; from: string; to: string; direction?: 'both' | 'none' | 'forward' }[],
) {
  const deck = deckOf({ nodes, groups: [{ id: 'core', title: 'Core' }], edges });
  const graph = visibleGraph(deck, { node: null, group: 'core' }, new Set());
  return { deck, graph, proxies: proxyLayout(deck, graph, 'system') };
}

describe('proxyLayout (034 R7)', () => {
  it('puts incoming-only proxies on the left and the rest on the right, 72 from the scope', () => {
    const { deck, graph, proxies } = layout(
      [inside('in1', 0), inside('in2', 200), outside('src'), outside('dst'), outside('both')],
      [
        { id: 'a', from: 'src', to: 'in1' },
        { id: 'b', from: 'in2', to: 'dst' },
        { id: 'c', from: 'both', to: 'in1' },
        { id: 'd', from: 'in1', to: 'both' },
      ],
    );
    const bounds = scopeBounds(deck, graph, 'system');
    if (bounds === null) throw new Error('no scope bounds');
    const src = proxies.find((p) => p.id === 'port:src');
    const dst = proxies.find((p) => p.id === 'port:dst');
    const both = proxies.find((p) => p.id === 'port:both');
    expect(src?.side).toBe('left');
    expect(dst?.side).toBe('right');
    expect(both?.side).toBe('right');
    expect(src?.rect.x).toBe(bounds.x - PROXY_SIZE.width - PROXY_OFFSET);
    expect(dst?.rect.x).toBe(bounds.x + bounds.width + PROXY_OFFSET);
    expect(src?.rect).toMatchObject(PROXY_SIZE);
  });

  it('treats a two-way or undirected connection as not incoming-only', () => {
    const { proxies } = layout(
      [inside('in1', 0), outside('x'), outside('y')],
      [
        { id: 'a', from: 'x', to: 'in1', direction: 'both' },
        { id: 'b', from: 'y', to: 'in1', direction: 'none' },
      ],
    );
    expect(proxies.map((p) => p.side)).toEqual(['right', 'right']);
  });

  it("carries the outside card's kind, title, connectors and one proxy per card", () => {
    const { proxies } = layout(
      [inside('in1', 0), inside('in2', 200), outside('db', 'database')],
      [
        { id: 'a', from: 'in1', to: 'db' },
        { id: 'b', from: 'in2', to: 'db' },
      ],
    );
    expect(proxies).toHaveLength(1);
    expect(proxies[0]).toMatchObject({
      id: 'port:db',
      outsideNodeId: 'db',
      title: 'Out db',
      kind: 'database',
      edgeIds: ['a', 'b'],
    });
  });

  it("carries the outside card's icon when it draws as a card (038)", () => {
    const { proxies } = layout(
      [
        inside('in1', 0),
        { ...outside('a', 'database'), icon: 'lucide:search' },
        { ...outside('b'), type: 'rectangle' as const, icon: 'lucide:search' },
        outside('c'),
      ],
      ['a', 'b', 'c'].map((to) => ({ id: `e-${to}`, from: 'in1', to })),
    );
    const byId = new Map(proxies.map((p) => [p.id, p]));
    expect(byId.get('port:a')?.icon).toBe('lucide:search');
    expect(byId.get('port:b')?.icon).toBeUndefined();
    expect(byId.get('port:c')).not.toHaveProperty('icon');
  });

  it('sorts a column by the mean height of the inside anchors', () => {
    const { proxies } = layout(
      [inside('top', 0), inside('low', 600), outside('o1'), outside('o2')],
      [
        { id: 'a', from: 'top', to: 'o2' },
        { id: 'b', from: 'low', to: 'o1' },
      ],
    );
    expect(proxies.map((p) => p.id)).toEqual(['port:o2', 'port:o1']);
    expect((proxies[0]?.rect.y ?? 0) < (proxies[1]?.rect.y ?? 0)).toBe(true);
  });

  it('stacks fifteen proxies with a 16 gap and no overlap', () => {
    const outs = Array.from({ length: 15 }, (_, i) => outside(`o${String(i)}`));
    const { proxies } = layout(
      [inside('in1', 0), ...outs],
      outs.map((o) => ({ id: `e-${o.id}`, from: 'in1', to: o.id })),
    );
    expect(proxies).toHaveLength(15);
    const sorted = [...proxies].sort((a, b) => a.rect.y - b.rect.y);
    sorted.slice(1).forEach((p, i) => {
      const prev = sorted[i];
      expect(p.rect.y - (prev?.rect.y ?? 0)).toBeGreaterThanOrEqual(PROXY_SIZE.height + PROXY_GAP);
    });
  });

  it('is empty when nothing connects outside, and at the top level', () => {
    const { proxies } = layout([inside('in1', 0)], []);
    expect(proxies).toEqual([]);
    const deck = deckOf({ nodes: [{ id: 'a', type: 'service', title: 'A' }] });
    expect(
      proxyLayout(deck, visibleGraph(deck, { node: null, group: null }, new Set()), 'system'),
    ).toEqual([]);
  });
});

describe('proxyLayout for tables a view hides (048)', () => {
  it('places a proxy from the port, though the table is not in the deck', () => {
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'db-table', title: 'orders', position: { x: 0, y: 0 } },
        { id: 'b', type: 'db-table', title: 'items', position: { x: 0, y: 200 } },
      ],
      edges: [
        { id: 'e1', from: 'a', to: 'hidden' },
        { id: 'e2', from: 'hidden2', to: 'b' },
      ],
    });
    const graph = visibleGraph(
      deck,
      { node: null, group: null },
      new Set(),
      new Map([
        ['hidden', { title: 'customers', kind: 'db-table' }],
        ['hidden2', { title: 'products', kind: 'db-table' }],
      ]),
    );
    const proxies = proxyLayout(deck, graph, 'system');
    expect(proxies.map((p) => [p.outsideNodeId, p.title, p.kind, p.side])).toEqual([
      ['hidden2', 'products', 'db-table', 'left'],
      ['hidden', 'customers', 'db-table', 'right'],
    ]);
  });
});
