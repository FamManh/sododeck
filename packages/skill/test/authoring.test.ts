import type { Node } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { authoringChecks, LEVEL_BUDGET, slugOf } from '../src/authoring';
import { deck } from './fixtures';

const card = (id: string, extra: Partial<Node> = {}): Node => ({
  id,
  type: 'service',
  title: id.toUpperCase(),
  ...extra,
});

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

  it('flags mixed positions, except in update mode', () => {
    const file = deck({
      nodes: [card('a', { position: { x: 0, y: 0 } }), card('b')],
      edges: [{ id: 'e', from: 'a', to: 'b' }],
    });
    expect(codes(authoringChecks(file))).toEqual(['positions-mixed']);
    expect(authoringChecks(file)[0]).toMatchObject({ path: '/nodes/1', subject: 'b' });
    expect(authoringChecks(file, { mode: 'update' })).toEqual([]);
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
    const nodes = Array.from({ length: 8 }, (_, i) => card(`n${String(i)}`, { group: 'g' }));
    const file = deck({ nodes, groups: [{ id: 'g', title: 'G' }] });
    expect(LEVEL_BUDGET.simplified).toBe(7);
    expect(codes(authoringChecks(file))).toEqual([]);
    const over = authoringChecks(file, { detail: 'simplified' });
    expect(codes(over)).toEqual(['level-over-budget']);
    expect(over[0]?.message).toMatch(
      /8 cards on the top level; the simplified detail level allows 7/,
    );
    expect(over[0]?.path).toBe('/nodes/7');
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
