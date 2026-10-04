import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../test/render-canvas';
import { applyJunction, planJunction } from './junction-table';

const file = (extra: Partial<SododeckFile> = {}): SododeckFile =>
  deckOf({
    dialect: 'postgres',
    nodes: [
      {
        id: 'p',
        type: 'db-table',
        title: 'products',
        schema: 'shop',
        position: { x: 0, y: 0 },
        columns: [{ id: 'p-id', name: 'id', type: 'uuid', pk: true, notNull: true }],
      },
      {
        id: 'c',
        type: 'db-table',
        title: 'categories',
        schema: 'shop',
        position: { x: 400, y: 200 },
        columns: [
          { id: 'c-a', name: 'a', type: 'varchar', size: '40', pk: true },
          { id: 'c-b', name: 'b', type: 'integer', pk: true },
        ],
      },
    ],
    edges: [{ id: 'e', from: 'p', to: 'c', cardinality: 'n-n' }],
    ...extra,
  });

describe('planJunction (047 R6)', () => {
  it('names the table, one key column per key column of each side, at the midpoint', () => {
    const plan = planJunction(file(), 'e');
    expect(plan).not.toBeNull();
    expect(plan?.name).toBe('products_categories');
    expect(plan?.schema).toBe('shop');
    expect(plan?.columns.map((c) => [c.name, c.type, c.size])).toEqual([
      ['products_id', 'uuid', undefined],
      ['categories_a', 'varchar', '40'],
      ['categories_b', 'integer', undefined],
    ]);
    expect(plan?.position).toEqual({ x: 200, y: 100 });
  });

  it('uses the ends the relationship names before the primary key', () => {
    const f = file();
    const edge = f.edges[0];
    if (edge === undefined) throw new Error('edge');
    edge.toColumns = ['c-b'];
    const plan = planJunction(f, 'e');
    expect(plan?.columns.map((c) => c.name)).toEqual(['products_id', 'categories_b']);
  });

  it('takes the next free name with _2', () => {
    const f = file();
    f.nodes.push({
      id: 'x',
      type: 'db-table',
      title: 'Products_Categories',
      schema: 'shop',
      columns: [],
    });
    expect(planJunction(f, 'e')?.name).toBe('products_categories_2');
  });

  it('plans nothing for a missing edge or a table without a key', () => {
    expect(planJunction(file(), 'nope')).toBeNull();
    const f = file();
    const c = f.nodes[1];
    if (c === undefined) throw new Error('c');
    c.columns = [{ id: 'c-a', name: 'a', type: 'text' }];
    expect(planJunction(f, 'e')).toBeNull();
  });
});

describe('applyJunction', () => {
  it('adds the table and two n-1 relationships, removes the n-n edge, in one undo step', () => {
    const doc = fromJSON(file());
    const editor = createEditor(doc);
    const before = toJSON(doc);
    const plan = planJunction(before, 'e');
    if (plan === null) throw new Error('plan');
    const id = applyJunction(editor, plan, 'e');
    const after = toJSON(doc);
    const table = after.nodes.find((n) => n.id === id);
    expect(table?.title).toBe('products_categories');
    expect(table?.columns?.every((c) => c.pk === true && c.notNull === true)).toBe(true);
    expect(after.edges.find((e) => e.id === 'e')).toBeUndefined();
    const links = after.edges.filter((e) => e.from === id);
    expect(links.map((e) => [e.to, e.cardinality, e.fromColumns?.length, e.toColumns])).toEqual([
      ['p', 'n-1', 1, ['p-id']],
      ['c', 'n-1', 2, ['c-a', 'c-b']],
    ]);
    editor.undo();
    expect(toJSON(doc)).toEqual(before);
    editor.destroy();
  });
});
