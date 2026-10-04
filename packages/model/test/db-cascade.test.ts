import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, fromJSON, serializeDeck, toJSON, type RemovalResult } from '../src';
import { expectValid, seqIds, shopDeck } from './helpers';

function setup(file: SododeckFile = shopDeck()) {
  const doc = fromJSON(file);
  const editor = createEditor(doc, { newId: seqIds() });
  return { doc, editor, deck: () => toJSON(doc) };
}

const node = (deck: SododeckFile, id: string) => deck.nodes.find((n) => n.id === id);
const edge = (deck: SododeckFile, id: string) => deck.edges.find((e) => e.id === id);
const refs = (list: RemovalResult['removed']) =>
  list.map((r) => (r.child === undefined ? `${r.scope}:${r.id}` : `${r.child.kind}:${r.child.id}`));

/** Runs a removal and checks one undo restores the exact prior deck. */
function removeAndUndo(
  file: SododeckFile,
  remove: (e: ReturnType<typeof setup>['editor']) => RemovalResult,
) {
  const { editor, deck } = setup(file);
  const before = serializeDeck(deck());
  const result = remove(editor);
  const after = deck();
  expectValid(editor.doc);
  expect(editor.undo()).toBe(true);
  expect(serializeDeck(deck())).toBe(before);
  return { result, after };
}

describe('removing a column (040 US5)', () => {
  it('drops it from indexes: an index of only that column goes, another keeps its other part', () => {
    const { result, after } = removeAndUndo(shopDeck(), (e) =>
      e.removeColumn('orders', 'o-customer'),
    );
    expect(node(after, 'orders')?.indexes).toEqual([
      { id: 'ix-mixed', name: 'orders_mixed', columns: ['o-total'] },
      { id: 'ix-expr', columns: [{ expr: 'lower(note)' }] },
    ]);
    expect(refs(result.removed)).toEqual([
      'column:o-customer',
      'index:ix-customer',
      'edges:r-orders-customer',
    ]);
    expect(refs(result.updated)).toEqual(['index:ix-mixed']);
  });

  it('removes a relationship whose end is that one column', () => {
    const { after } = removeAndUndo(shopDeck(), (e) => e.removeColumn('customers', 'c-id'));
    expect(edge(after, 'r-orders-customer')).toBeUndefined();
    expect(after.edges.map((e) => e.id)).toEqual(['r-ship-item', 'r-cat-parent']);
  });

  it('drops the matching pair of a composite end and keeps the relationship', () => {
    const { result, after } = removeAndUndo(shopDeck(), (e) => e.removeColumn('items', 'i-order'));
    expect(edge(after, 'r-ship-item')).toMatchObject({
      fromColumns: ['s-line'],
      toColumns: ['i-line'],
    });
    expect(refs(result.updated)).toEqual(['edges:r-ship-item']);
  });

  it('removes a composite relationship when its last pair goes', () => {
    const { editor, deck } = setup();
    editor.removeColumn('shipments', 's-order');
    const result = editor.removeColumn('shipments', 's-line');
    expect(edge(deck(), 'r-ship-item')).toBeUndefined();
    expect(refs(result.removed)).toEqual(['column:s-line', 'edges:r-ship-item']);
  });

  it('checks both ends of a self-reference', () => {
    const fromEnd = removeAndUndo(shopDeck(), (e) => e.removeColumn('categories', 'cat-parent'));
    expect(edge(fromEnd.after, 'r-cat-parent')).toBeUndefined();
    const toEnd = removeAndUndo(shopDeck(), (e) => e.removeColumn('categories', 'cat-id'));
    expect(edge(toEnd.after, 'r-cat-parent')).toBeUndefined();
  });

  it('leaves relationships of other tables alone, and refuses an unknown column', () => {
    const { editor, deck } = setup();
    const edges = deck().edges;
    editor.removeColumn('orders', 'o-total');
    expect(deck().edges).toEqual(edges);
    expect(() => editor.removeColumn('orders', 'c-id')).toThrow(/does not exist/);
  });
});

describe('removing other parts (040 US5)', () => {
  it('removes an index or a check and nothing else', () => {
    const index = removeAndUndo(shopDeck(), (e) => e.removeIndex('orders', 'ix-expr'));
    expect(refs(index.result.removed)).toEqual(['index:ix-expr']);
    expect(index.result.updated).toEqual([]);
    const check = removeAndUndo(shopDeck(), (e) => e.removeCheck('orders', 'ck-total'));
    expect(node(check.after, 'orders')?.checks).toEqual([]);
  });

  it('clears enumRef on every column naming a removed enum and keeps their types', () => {
    const { result, after } = removeAndUndo(shopDeck(), (e) => e.removeEnum('e-status'));
    expect(after.enums).toEqual([]);
    expect(node(after, 'customers')?.columns?.[2]).toEqual({
      id: 'c-status',
      name: 'status',
      type: 'customer_status',
    });
    expect(node(after, 'categories')?.columns?.[1]).not.toHaveProperty('enumRef');
    expect(refs(result.removed)).toEqual(['enum:e-status']);
    expect(refs(result.updated)).toEqual(['nodes:customers', 'nodes:categories']);
  });

  it('removes an enum value and nothing else', () => {
    const { result, after } = removeAndUndo(shopDeck(), (e) =>
      e.removeEnumValue('e-status', 'ev-blocked'),
    );
    expect(after.enums?.[0]?.values).toEqual([{ id: 'ev-active', name: 'active' }]);
    expect(refs(result.removed)).toEqual(['enum-value:ev-blocked']);
    expect(result.updated).toEqual([]);
  });

  it('removes a table with its relationships through the node cascade', () => {
    const { result, after } = removeAndUndo(shopDeck(), (e) => e.remove('nodes', 'items'));
    expect(edge(after, 'r-ship-item')).toBeUndefined();
    expect(refs(result.removed)).toEqual(['nodes:items', 'edges:r-ship-item']);
  });
});

describe('step touches on delete and rename (049 R7)', () => {
  function withTouches(): SododeckFile {
    const file = shopDeck();
    file.nodes.push({ id: 'svc', type: 'service', title: 'Orders' });
    file.edges.push({ id: 'e-svc', from: 'svc', to: 'svc' });
    file.flows = [
      {
        id: 'fl',
        title: 'Checkout',
        steps: [
          {
            id: 's1',
            edge: 'e-svc',
            touches: [
              { table: 'orders', access: 'write' },
              { table: 'orders', column: 'o-total', access: 'write' },
              { table: 'customers', column: 'c-email', access: 'read' },
            ],
          },
          { id: 's2', edge: 'e-svc', touches: [{ table: 'orders', access: 'read' }] },
        ],
      },
    ];
    return file;
  }
  const touchesOf = (deck: SododeckFile, stepId: string) =>
    deck.flows[0]?.steps.find((s) => s.id === stepId)?.touches;

  it('deleting a table removes its table and column touches and keeps the steps', () => {
    const { result, after } = removeAndUndo(withTouches(), (e) => e.remove('nodes', 'orders'));
    expect(touchesOf(after, 's1')).toEqual([
      { table: 'customers', column: 'c-email', access: 'read' },
    ]);
    expect(after.flows[0]?.steps.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(touchesOf(after, 's2')).toBeUndefined();
    expect(refs(result.updated)).toEqual(expect.arrayContaining(['step:s1', 'step:s2']));
    expect(result.broken).toEqual([]);
  });

  it('deleting a column removes only the touches naming it', () => {
    const { result, after } = removeAndUndo(withTouches(), (e) =>
      e.removeColumn('customers', 'c-email'),
    );
    expect(touchesOf(after, 's1')).toEqual([
      { table: 'orders', access: 'write' },
      { table: 'orders', column: 'o-total', access: 'write' },
    ]);
    expect(touchesOf(after, 's2')).toEqual([{ table: 'orders', access: 'read' }]);
    expect(refs(result.updated)).toContain('step:s1');
    expect(result.broken).toEqual([]);
  });

  it('renaming a table and a column leaves touches as they are', () => {
    const { editor, deck } = setup(withTouches());
    const before = deck().flows;
    editor.update('nodes', 'orders', { title: 'purchase_orders' });
    editor.updateColumn('orders', 'o-total', { name: 'amount' });
    expect(deck().flows).toEqual(before);
    expectValid(editor.doc);
  });
});
