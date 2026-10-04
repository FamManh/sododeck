import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf } from '../test/render-canvas';
import { connectColumns, connectComponents } from './canvas-actions';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 300, y: 0 } },
    { id: 'c', type: 'service', title: 'C', position: { x: 600, y: 0 } },
  ],
});

function setup() {
  const doc = fromJSON(deck);
  return { doc, editor: createEditor(doc) };
}

beforeEach(() => {
  useUiStore.getState().resetForDeck();
  useUiStore.getState().setLastLineShape('curved');
});

describe('connectComponents line type (029 T045)', () => {
  it('draws a curved connector, with no stored style, on a fresh store', () => {
    const { doc, editor } = setup();
    const id = connectComponents(editor, 'a', 'b');
    expect(toJSON(doc).edges.find((e) => e.id === id)).not.toHaveProperty('style');
  });

  it('gives the new connector the last picked line type, in one undo step', () => {
    const { doc, editor } = setup();
    useUiStore.getState().setLastLineShape('elbow');
    const id = connectComponents(editor, 'a', 'b');
    expect(toJSON(doc).edges.find((e) => e.id === id)?.style).toEqual({ shape: 'elbow' });
    editor.undo();
    expect(toJSON(doc).edges).toEqual([]);
  });

  it('keeps lastLineShape across undo and opening another deck', () => {
    const { editor } = setup();
    useUiStore.getState().setLastLineShape('straight');
    connectComponents(editor, 'a', 'b');
    editor.undo();
    useUiStore.getState().resetForDeck('other');
    expect(useUiStore.getState().lastLineShape).toBe('straight');
  });
});

describe('connectColumns (042 FR-017, FR-019)', () => {
  const col = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    name: id.split('.')[1] ?? id,
    type: 'uuid',
    ...extra,
  });
  const tables = deckOf({
    nodes: [
      {
        id: 'orders',
        type: 'db-table',
        title: 'orders',
        position: { x: 0, y: 0 },
        columns: [
          col('orders.id', { pk: true }),
          col('orders.customer_id', { notNull: true }),
          col('orders.coupon_id'),
        ],
      },
      {
        id: 'customers',
        type: 'db-table',
        title: 'customers',
        position: { x: 400, y: 0 },
        columns: [col('customers.id', { pk: true })],
      },
    ],
  });
  const setupTables = () => {
    const doc = fromJSON(tables);
    return { doc, editor: createEditor(doc) };
  };
  const source = { tableId: 'orders', columnId: 'orders.customer_id' };
  const target = { tableId: 'customers', columnId: 'customers.id' };

  it('writes an n–1 relationship with the many side optional', () => {
    const { doc, editor } = setupTables();
    const id = connectColumns(editor, source, target);
    expect(toJSON(doc).edges).toEqual([
      {
        id,
        from: 'orders',
        to: 'customers',
        fromColumns: ['orders.customer_id'],
        toColumns: ['customers.id'],
        cardinality: 'n-1',
        fromOptional: true,
      },
    ]);
    expect(useUiStore.getState().selection.edges).toEqual([id]);
  });

  it('makes the target side optional when the source column is nullable', () => {
    const { doc, editor } = setupTables();
    connectColumns(editor, { tableId: 'orders', columnId: 'orders.coupon_id' }, target);
    expect(toJSON(doc).edges[0]?.toOptional).toBe(true);
  });

  it('stores the last line type', () => {
    const { doc, editor } = setupTables();
    useUiStore.getState().setLastLineShape('elbow');
    connectColumns(editor, source, target);
    expect(toJSON(doc).edges[0]?.style).toEqual({ shape: 'elbow' });
  });

  it('is one undo step; redo brings back the same id', () => {
    const { doc, editor } = setupTables();
    const id = connectColumns(editor, source, target);
    editor.undo();
    expect(toJSON(doc).edges).toEqual([]);
    editor.redo();
    expect(toJSON(doc).edges[0]?.id).toBe(id);
  });

  it('selects the existing relationship instead of a duplicate', () => {
    const { doc, editor } = setupTables();
    const id = connectColumns(editor, source, target);
    useUiStore.getState().select({ nodes: ['orders'] });
    expect(connectColumns(editor, source, target)).toBe(id);
    expect(toJSON(doc).edges).toHaveLength(1);
    expect(useUiStore.getState().selection.edges).toEqual([id]);
  });

  it('writes nothing for the source row itself', () => {
    const { doc, editor } = setupTables();
    expect(connectColumns(editor, source, source)).toBeNull();
    expect(toJSON(doc).edges).toEqual([]);
  });
});
