import type { Node } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { authoringChecks, LEVEL_BUDGET, slugOf } from '../src/authoring';
import { deck } from './fixtures';

let placed = 0;
/** A card placed on a parabola, so no three cards line up and no connector runs over a card. */
const card = (id: string, extra: Partial<Node> = {}): Node => {
  const i = placed++;
  return {
    id,
    type: 'service',
    title: id.toUpperCase(),
    position: { x: i * 300, y: i * i * 150 },
    ...extra,
  };
};
const at = (x: number, y: number) => ({ position: { x, y } });

const codes = (entries: { code: string }[]) => entries.map((e) => e.code);

describe('authoring checks (027 research R5)', () => {
  it('reports nothing for a small connected deck', () => {
    const file = deck({
      nodes: [card('api'), card('db', { type: 'database' })],
      edges: [{ id: 'e1', from: 'api', to: 'db' }],
    });
    expect(authoringChecks(file)).toEqual([]);
  });

  it('flags long, upper-case and title-shaped ids, not short slugs', () => {
    const file = deck({
      nodes: [
        card('api', { title: 'API', group: 'g' }),
        card('x'.repeat(33), { group: 'g' }),
        card('OrderService', { group: 'g' }),
        card('order-service-v2-new', { title: 'Order Service v2 (new)', group: 'g' }),
      ],
      groups: [{ id: 'g', title: 'G' }],
    });
    const entries = authoringChecks(file).filter((e) => e.code === 'id-style');
    expect(entries.map((e) => e.subject)).toEqual([
      'x'.repeat(33),
      'OrderService',
      'order-service-v2-new',
    ]);
    expect(entries[0]).toMatchObject({ severity: 'warning', path: '/nodes/1/id' });
    expect(entries[0]?.fix).toMatch(/slug/);
  });

  it('slugs titles the way an agent would', () => {
    expect(slugOf('Order Service v2 (new)')).toBe('order-service-v2-new');
    expect(slugOf('Café Áp')).toBe('cafe-ap');
  });

  it('asks for a position on every card, in every mode', () => {
    const file = deck({
      nodes: [card('a'), { id: 'b', type: 'service', title: 'B' }],
      edges: [{ id: 'e', from: 'a', to: 'b' }],
    });
    for (const mode of ['new', 'update', 'codebase'] as const) {
      expect(codes(authoringChecks(file, { mode }))).toContain('card-without-position');
    }
    const entry = authoringChecks(file).find((e) => e.code === 'card-without-position');
    expect(entry).toMatchObject({ path: '/nodes/1', subject: 'b' });
  });

  it('flags a connector that runs over a card, on its own level only', () => {
    const file = deck({
      nodes: [
        card('a', at(0, 0)),
        card('mid', at(300, 0)),
        card('b', at(600, 0)),
        card('below', { ...at(300, 0), parent: 'a' }),
      ],
      edges: [{ id: 'e', from: 'a', to: 'b' }],
    });
    const entries = authoringChecks(file).filter((e) => e.code === 'connector-crosses-card');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ path: '/edges/0', subject: 'e' });
    expect(entries[0]?.message).toMatch(/runs over "mid"/);
  });

  it('lets a bend take a connector around a card', () => {
    const file = deck({
      nodes: [card('a', at(0, 0)), card('mid', at(300, 0)), card('b', at(600, 0))],
      edges: [
        {
          id: 'e',
          from: 'a',
          to: 'b',
          route: {
            waypoints: [
              { x: 0, dy: -200 },
              { x: 1, dy: -200 },
            ],
          },
        },
      ],
    });
    expect(codes(authoringChecks(file))).not.toContain('connector-crosses-card');
  });

  it('flags a frame that covers a foreign card and sibling frames that overlap', () => {
    const file = deck({
      nodes: [
        card('a1', { ...at(0, 0), group: 'a' }),
        card('a2', { ...at(0, 400), group: 'a' }),
        card('stray', at(0, 200)),
        card('b1', { ...at(150, 600), group: 'b' }),
        card('c1', { ...at(1000, 0), group: 'c1g' }),
        card('c2', { ...at(1000, 300), group: 'c2g' }),
      ],
      groups: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
        { id: 'outer', title: 'Outer' },
        { id: 'c1g', title: 'C1', parent: 'outer' },
        { id: 'c2g', title: 'C2', parent: 'outer' },
      ],
    });
    const entries = authoringChecks(file);
    expect(entries.filter((e) => e.code === 'frame-covers-card').map((e) => e.message)).toEqual([
      'The frame of group "a" covers card "stray", which is not in it.',
    ]);
    // a ends at y 496 + 24, b starts at 600 − 40: a gap. Nested c1g / c2g sit inside outer.
    expect(entries.filter((e) => e.code === 'frames-overlap')).toEqual([]);
    const moved = deck({
      ...file,
      nodes: file.nodes.map((n) => (n.id === 'b1' ? { ...n, position: { x: 150, y: 500 } } : n)),
    });
    expect(
      authoringChecks(moved)
        .filter((e) => e.code === 'frames-overlap')
        .map((e) => e.subject),
    ).toEqual(['b']);
  });

  it('flags a lone card, but not one in a group, a parent or a touched table', () => {
    const file = deck({
      nodes: [
        card('alone'),
        card('grouped', { group: 'g' }),
        card('parent'),
        card('child', { parent: 'parent', group: 'g' }),
        card('table', { type: 'db-table' }),
        card('a', { group: 'g' }),
        card('b', { group: 'g' }),
      ],
      groups: [{ id: 'g', title: 'G' }],
      edges: [{ id: 'e', from: 'a', to: 'b' }],
      flows: [
        {
          id: 'f',
          title: 'F',
          steps: [{ id: 's', edge: 'e', touches: [{ table: 'table', access: 'read' }] }],
        },
      ],
    });
    const orphans = authoringChecks(file).filter((e) => e.code === 'orphan-card');
    expect(orphans.map((e) => e.subject)).toEqual(['alone']);
  });

  it('flags the same title twice in one group and level only', () => {
    const file = deck({
      nodes: [
        card('a', { title: 'Worker', group: 'g' }),
        card('b', { title: ' worker ', group: 'g' }),
        card('c', { title: 'Worker', group: 'h' }),
      ],
      groups: [
        { id: 'g', title: 'G' },
        { id: 'h', title: 'H' },
      ],
    });
    const entries = authoringChecks(file).filter((e) => e.code === 'duplicate-title');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ path: '/nodes/1/title', subject: 'b' });
  });

  it('flags titles over 40 and connector labels over 32 characters', () => {
    const file = deck({
      nodes: [card('a', { title: 'A'.repeat(41) }), card('b', { title: 'B'.repeat(40) })],
      edges: [{ id: 'e', from: 'a', to: 'b', label: 'L'.repeat(33) }],
    });
    const entries = authoringChecks(file).filter((e) => e.code === 'label-too-long');
    expect(entries.map((e) => e.path)).toEqual(['/nodes/0/title', '/edges/0/label']);
  });

  it('counts cards per level against the detail budget', () => {
    const nodes = Array.from({ length: 11 }, (_, i) => card(`n${String(i)}`, { group: 'g' }));
    const file = deck({ nodes, groups: [{ id: 'g', title: 'G' }] });
    expect(LEVEL_BUDGET.simplified).toBe(10);
    expect(codes(authoringChecks(file))).toEqual([]);
    const over = authoringChecks(file, { detail: 'simplified' });
    expect(codes(over)).toEqual(['level-over-budget']);
    expect(over[0]?.message).toMatch(
      /11 cards on the top level; the simplified detail level allows 10/,
    );
    expect(over[0]?.path).toBe('/nodes/10');
  });

  it('asks for source links in codebase mode only', () => {
    const file = deck({
      nodes: [card('a', { links: [{ url: 'src/a.ts#L1-L9' }] }), card('b')],
      edges: [{ id: 'e', from: 'a', to: 'b' }],
    });
    expect(authoringChecks(file)).toEqual([]);
    const entries = authoringChecks(file, { mode: 'codebase' });
    expect(entries.map((e) => `${e.code} ${e.subject ?? ''}`)).toEqual([
      'connector-without-source b',
      'connector-without-source e',
    ]);
  });
});
