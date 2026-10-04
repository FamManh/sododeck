import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  createDeckSnapshot,
  createEditor,
  DeckEditError,
  deckDialect,
  fromJSON,
  observeDeck,
  serializeDeck,
  tableDisplayOf,
  toJSON,
  type DeckEditor,
} from '../src';
import { expectValid, seqIds, shopDeck } from './helpers';

function setup(file: SododeckFile = shopDeck()) {
  const doc = fromJSON(file);
  const editor = createEditor(doc, { newId: seqIds() });
  return { doc, editor, deck: () => toJSON(doc) };
}

const codeOf = (fn: () => unknown): string | null => {
  try {
    fn();
  } catch (error) {
    return error instanceof DeckEditError ? error.code : 'other';
  }
  return null;
};

/** Runs `fn` and asserts it is exactly one undo step that restores the deck. */
function oneStep(editor: DeckEditor, deck: () => SododeckFile, fn: () => void): void {
  const before = serializeDeck(deck());
  fn();
  expect(serializeDeck(deck())).not.toBe(before);
  expect(editor.undo()).toBe(true);
  expect(serializeDeck(deck())).toBe(before);
  expect(editor.redo()).toBe(true);
}

/** Refused with `code`, and nothing written. */
function refused(deck: () => SododeckFile, code: string, fn: () => unknown): void {
  const before = serializeDeck(deck());
  expect(codeOf(fn)).toBe(code);
  expect(serializeDeck(deck())).toBe(before);
}

const table = (deck: SododeckFile, id: string) => {
  const node = deck.nodes.find((n) => n.id === id);
  if (node === undefined) throw new Error(`no table ${id}`);
  return node;
};
const columnIds = (deck: SododeckFile, id: string) =>
  (table(deck, id).columns ?? []).map((c) => c.id);
const column = (deck: SododeckFile, tableId: string, columnId: string) =>
  table(deck, tableId).columns?.find((c) => c.id === columnId);

describe('columns (040 US2)', () => {
  it('adds a column with a generated id at the end, one undo step', () => {
    const { editor, deck } = setup();
    let id = '';
    oneStep(editor, deck, () => {
      id = editor.addColumn('orders', { name: 'note', type: 'text' });
    });
    expect(id).toMatch(/^dbcol-/);
    expect(columnIds(deck(), 'orders')).toEqual(['o-id', 'o-customer', 'o-total', id]);
    expect(column(deck(), 'orders', id)).toEqual({ id, name: 'note', type: 'text' });
    expectValid(editor.doc);
  });

  it('adds a column with a given id at an index, and starts a table with no columns', () => {
    const { editor, deck } = setup({
      ...shopDeck(),
      nodes: [...shopDeck().nodes, { id: 'empty', type: 'db-table', title: 'empty' }],
    });
    expect(editor.addColumn('orders', { id: 'o-first', name: 'a', type: 'int' }, 0)).toBe(
      'o-first',
    );
    expect(columnIds(deck(), 'orders')[0]).toBe('o-first');
    editor.addColumn('empty', { id: 'x', name: 'x', type: 'int', pk: true, notNull: false });
    expect(table(deck(), 'empty').columns).toEqual([{ id: 'x', name: 'x', type: 'int', pk: true }]);
  });

  it('refuses an id already used by a part of another table, and a non-table node', () => {
    const { editor, deck } = setup();
    refused(deck, 'duplicate-id', () =>
      editor.addColumn('orders', { id: 'c-id', name: 'x', type: 'int' }),
    );
    refused(deck, 'duplicate-id', () =>
      editor.addColumn('orders', { id: 'ev-active', name: 'x', type: 'int' }),
    );
    refused(deck, 'invalid', () => editor.addColumn('db', { name: 'x', type: 'int' }));
    refused(deck, 'not-found', () => editor.addColumn('nope', { name: 'x', type: 'int' }));
    refused(deck, 'invalid', () => editor.addColumn('orders', { name: '', type: 'int' }));
    refused(deck, 'missing-reference', () =>
      editor.addColumn('orders', { name: 'x', type: 'int', enumRef: 'gone' }),
    );
  });

  it('renames and retypes a column; flags write true, false and null remove them', () => {
    const { editor, deck } = setup();
    oneStep(editor, deck, () => {
      editor.updateColumn('orders', 'o-total', { name: 'amount', type: 'decimal' });
    });
    editor.updateColumn('orders', 'o-total', { unique: true, notNull: true });
    expect(column(deck(), 'orders', 'o-total')).toEqual({
      id: 'o-total',
      name: 'amount',
      type: 'decimal',
      size: '10,2',
      notNull: true,
      unique: true,
    });
    editor.updateColumn('orders', 'o-total', { unique: false, notNull: null, size: null });
    expect(column(deck(), 'orders', 'o-total')).toEqual({
      id: 'o-total',
      name: 'amount',
      type: 'decimal',
    });
  });

  it('checks enumRef and the single default (S14)', () => {
    const { editor, deck } = setup();
    refused(deck, 'missing-reference', () => {
      editor.updateColumn('orders', 'o-total', { enumRef: 'gone' });
    });
    editor.updateColumn('orders', 'o-total', { default: 0 });
    refused(deck, 'invalid', () => {
      editor.updateColumn('orders', 'o-total', { defaultExpr: 'now()' });
    });
    editor.updateColumn('orders', 'o-total', { default: null, defaultExpr: 'now()' });
    expect(column(deck(), 'orders', 'o-total')).toMatchObject({ defaultExpr: 'now()' });
    expect(column(deck(), 'orders', 'o-total')).not.toHaveProperty('default');
    refused(deck, 'not-found', () => {
      editor.updateColumn('orders', 'c-id', { name: 'x' });
    });
  });

  it('moves a column by writing one order key', () => {
    const { editor, deck } = setup();
    oneStep(editor, deck, () => {
      editor.moveColumn('orders', 'o-total', 0);
    });
    expect(columnIds(deck(), 'orders')).toEqual(['o-total', 'o-id', 'o-customer']);
  });

  it('refuses columns, indexes and checks through update(nodes)', () => {
    const { editor, deck } = setup();
    for (const key of ['columns', 'indexes', 'checks'] as const) {
      refused(deck, 'invalid', () => {
        editor.update('nodes', 'orders', { [key]: [] });
      });
    }
  });

  it('sets schema, expanded and detail through update(nodes); expanded false removes it', () => {
    const { editor, deck } = setup();
    oneStep(editor, deck, () => {
      editor.update('nodes', 'orders', { schema: 'sales', expanded: true, detail: 'keys' });
    });
    expect(table(deck(), 'orders')).toMatchObject({
      schema: 'sales',
      expanded: true,
      detail: 'keys',
    });
    editor.update('nodes', 'orders', { expanded: false });
    expect(table(deck(), 'orders')).not.toHaveProperty('expanded');
  });
});

describe('indexes and checks (040 US2)', () => {
  it('adds, changes and moves an index; parts must be columns of the table', () => {
    const { editor, deck } = setup();
    let id = '';
    oneStep(editor, deck, () => {
      id = editor.addIndex('orders', { columns: ['o-total', { expr: 'id % 7' }], unique: true });
    });
    expect(id).toMatch(/^dbidx-/);
    refused(deck, 'missing-reference', () => editor.addIndex('orders', { columns: ['c-id'] }));
    refused(deck, 'invalid', () => editor.addIndex('orders', { columns: [] }));
    oneStep(editor, deck, () => {
      editor.updateIndex('orders', id, { name: 'orders_total', method: 'hash' });
    });
    refused(deck, 'missing-reference', () => {
      editor.updateIndex('orders', id, { columns: ['nope'] });
    });
    editor.moveIndex('orders', id, 0);
    expect(table(deck(), 'orders').indexes?.[0]).toEqual({
      id,
      name: 'orders_total',
      columns: ['o-total', { expr: 'id % 7' }],
      unique: true,
      method: 'hash',
    });
  });

  it('adds, changes and moves a check', () => {
    const { editor, deck } = setup();
    let id = '';
    oneStep(editor, deck, () => {
      id = editor.addCheck('orders', { expr: 'id > 0' }, 0);
    });
    expect(id).toMatch(/^dbchk-/);
    editor.updateCheck('orders', id, { name: 'id_positive' });
    editor.moveCheck('orders', id, 5);
    expect(table(deck(), 'orders').checks).toEqual([
      { id: 'ck-total', name: 'total_positive', expr: 'total >= 0' },
      { id, name: 'id_positive', expr: 'id > 0' },
    ]);
    refused(deck, 'invalid', () => {
      editor.updateCheck('orders', id, { expr: '' });
    });
  });
});

describe('renames never break references (040 US2)', () => {
  it('renaming a column used by an edge end, an index and a check changes only its name', () => {
    const { editor, deck } = setup();
    const before = deck();
    editor.updateColumn('orders', 'o-customer', { name: 'buyer_id' });
    const after = deck();
    expect(after.edges).toEqual(before.edges);
    expect(table(after, 'orders').indexes).toEqual(table(before, 'orders').indexes);
    expect(table(after, 'orders').checks).toEqual(table(before, 'orders').checks);
    const expected = structuredClone(before);
    const renamed = table(expected, 'orders').columns?.[1];
    if (renamed !== undefined) renamed.name = 'buyer_id';
    expect(after).toEqual(expected);
  });

  it('renaming an enum keeps every column pointing at it', () => {
    const { editor, deck } = setup();
    editor.updateEnum('e-status', { name: 'account_state' });
    expect(column(deck(), 'customers', 'c-status')?.enumRef).toBe('e-status');
    expect(deck().enums?.[0]?.name).toBe('account_state');
  });

  it('renaming a table or changing its schema keeps its relationships', () => {
    const { editor, deck } = setup();
    const edges = deck().edges;
    editor.update('nodes', 'customers', { title: 'clients', schema: 'crm' });
    expect(deck().edges).toEqual(edges);
  });

  it('renaming an enum value keeps its id', () => {
    const { editor, deck } = setup();
    editor.updateEnumValue('e-status', 'ev-active', { name: 'enabled' });
    expect(deck().enums?.[0]?.values[0]).toEqual({ id: 'ev-active', name: 'enabled' });
  });
});

describe('relationship ends (040 US2)', () => {
  it('checks column ends against the end table when that end is a table', () => {
    const { editor, deck } = setup();
    refused(deck, 'missing-reference', () => {
      editor.update('edges', 'r-orders-customer', { fromColumns: ['missing'] });
    });
    refused(deck, 'missing-reference', () => {
      editor.update('edges', 'r-orders-customer', { toColumns: ['o-id'] });
    });
    editor.update('edges', 'r-orders-customer', { fromColumns: ['o-id'], toColumns: ['c-email'] });
    expect(deck().edges[0]).toMatchObject({ fromColumns: ['o-id'], toColumns: ['c-email'] });
    refused(deck, 'missing-reference', () =>
      editor.add('edges', { from: 'orders', to: 'items', fromColumns: ['c-id'] }),
    );
  });

  it('checks ends on other cards by shape only', () => {
    const { editor, deck } = setup({
      ...shopDeck(),
      nodes: [
        ...shopDeck().nodes,
        { id: 'svc-a', type: 'service', title: 'A' },
        { id: 'svc-b', type: 'service', title: 'B' },
      ],
    });
    const id = editor.add('edges', { from: 'svc-a', to: 'svc-b', fromColumns: ['anything'] });
    editor.update('edges', id, { toColumns: ['whatever'] });
    expect(deck().edges.at(-1)).toMatchObject({
      fromColumns: ['anything'],
      toColumns: ['whatever'],
    });
    refused(deck, 'invalid', () => {
      editor.update('edges', id, { toColumns: [] });
    });
  });

  it('sets and clears cardinality, optional sides and actions', () => {
    const { editor, deck } = setup();
    oneStep(editor, deck, () => {
      editor.update('edges', 'r-ship-item', {
        cardinality: '1-1',
        fromOptional: true,
        onDelete: 'set-null',
        onUpdate: 'cascade',
      });
    });
    editor.update('edges', 'r-ship-item', {
      cardinality: null,
      fromOptional: null,
      onDelete: null,
    });
    expect(deck().edges[1]).toEqual({
      id: 'r-ship-item',
      from: 'shipments',
      to: 'items',
      fromColumns: ['s-order', 's-line'],
      toColumns: ['i-order', 'i-line'],
      onUpdate: 'cascade',
    });
  });
});

describe('dialect (040 US6)', () => {
  const plain: SododeckFile = { ...shopDeck(), dialect: undefined, enums: undefined };
  delete plain.dialect;
  delete plain.enums;

  it('reads generic when absent, from a file or a document', () => {
    const { doc } = setup(plain);
    expect(deckDialect(plain)).toBe('generic');
    expect(deckDialect(doc)).toBe('generic');
    expect(deckDialect(shopDeck())).toBe('postgres');
  });

  it('writes the key in one undo step; generic and null remove it', () => {
    const { editor, deck, doc } = setup(plain);
    oneStep(editor, deck, () => {
      editor.setDialect('mysql');
    });
    expect(deck().dialect).toBe('mysql');
    expect(deckDialect(doc)).toBe('mysql');
    editor.setDialect('generic');
    expect(deck()).not.toHaveProperty('dialect');
    editor.setDialect('sqlite');
    editor.setDialect(null);
    expect(deck()).not.toHaveProperty('dialect');
    refused(deck, 'invalid', () => {
      editor.setDialect('oracle' as never);
    });
  });
});

describe('enums (040 US6)', () => {
  it('creates the deck enums list on the first add, with generated ids', () => {
    const file = { ...shopDeck() };
    delete file.enums;
    const nodes = file.nodes.map((n) => ({
      ...n,
      columns: n.columns?.map(({ enumRef: _ref, ...c }) => c),
    }));
    const { editor, deck } = setup({ ...file, nodes });
    expect(deck()).not.toHaveProperty('enums');
    let id = '';
    oneStep(editor, deck, () => {
      id = editor.addEnum({
        name: 'mood',
        values: [{ name: 'happy' }, { id: 'v-sad', name: 'sad' }],
      });
    });
    expect(id).toMatch(/^enum-/);
    expect(deck().enums).toEqual([
      {
        id,
        name: 'mood',
        values: [
          { id: expect.stringMatching(/^enumval-/) as string, name: 'happy' },
          { id: 'v-sad', name: 'sad' },
        ],
      },
    ]);
  });

  it('updates, moves and removes; value ops work in place', () => {
    const { editor, deck } = setup();
    const second = editor.addEnum({ name: 'priority', schema: 'ops' });
    expect(deck().enums?.[1]).toEqual({ id: second, name: 'priority', schema: 'ops', values: [] });
    oneStep(editor, deck, () => {
      editor.updateEnum(second, { schema: null, note: 'How urgent.' });
    });
    editor.moveEnum(second, 0);
    expect(deck().enums?.map((e) => e.id)).toEqual([second, 'e-status']);
    const low = editor.addEnumValue(second, { name: 'low' });
    const high = editor.addEnumValue(second, { name: 'high', note: 'Page someone.' }, 0);
    editor.moveEnumValue(second, low, 0);
    editor.updateEnumValue(second, high, { note: null });
    expect(deck().enums?.[0]?.values).toEqual([
      { id: low, name: 'low' },
      { id: high, name: 'high' },
    ]);
    oneStep(editor, deck, () => {
      editor.removeEnumValue(second, low);
    });
    expect(deck().enums?.[0]?.values.map((v) => v.id)).toEqual([high]);
  });

  it('refuses ids used by another database part, bad names and unknown enums', () => {
    const { editor, deck } = setup();
    refused(deck, 'duplicate-id', () => editor.addEnum({ id: 'c-id', name: 'x' }));
    refused(deck, 'duplicate-id', () =>
      editor.addEnum({
        name: 'x',
        values: [
          { id: 'v', name: 'a' },
          { id: 'v', name: 'b' },
        ],
      }),
    );
    refused(deck, 'duplicate-id', () =>
      editor.addEnumValue('e-status', { id: 'o-total', name: 'x' }),
    );
    refused(deck, 'invalid', () => editor.addEnum({ name: '' }));
    refused(deck, 'invalid', () => {
      editor.updateEnum('e-status', { values: [] } as never);
    });
    refused(deck, 'not-found', () => {
      editor.updateEnum('gone', { name: 'x' });
    });
    refused(deck, 'not-found', () => {
      editor.updateEnumValue('e-status', 'gone', { name: 'x' });
    });
  });
});

describe('table display (041)', () => {
  it('reads defaults when absent, and the stored keys otherwise', () => {
    expect(tableDisplayOf(shopDeck())).toEqual({
      detail: 'auto',
      hideTypes: false,
      hideNullable: false,
      hideNotes: false,
      hideIndexes: false,
    });
    expect(
      tableDisplayOf({ ...shopDeck(), tableDisplay: { detail: 'keys', hideNotes: true } }),
    ).toEqual({
      detail: 'keys',
      hideTypes: false,
      hideNullable: false,
      hideNotes: true,
      hideIndexes: false,
    });
  });

  it('writes a key in one undo step and creates the object on the first write', () => {
    const { editor, deck } = setup();
    expect(deck()).not.toHaveProperty('tableDisplay');
    oneStep(editor, deck, () => {
      editor.setTableDisplay({ detail: 'keys', hideTypes: true });
    });
    expect(deck().tableDisplay).toEqual({ detail: 'keys', hideTypes: true });
  });

  it('removes a hide flag written false, detail written null, and the emptied object', () => {
    const { editor, deck } = setup({
      ...shopDeck(),
      tableDisplay: { detail: 'names', hideNotes: true, hideIndexes: true },
    });
    editor.setTableDisplay({ hideNotes: false });
    expect(deck().tableDisplay).toEqual({ detail: 'names', hideIndexes: true });
    editor.setTableDisplay({ detail: null, hideIndexes: null });
    expect(deck()).not.toHaveProperty('tableDisplay');
  });

  it('does nothing when nothing changes, and refuses bad values', () => {
    const { editor, deck } = setup();
    const before = serializeDeck(deck());
    editor.setTableDisplay({ hideTypes: false, detail: null });
    expect(serializeDeck(deck())).toBe(before);
    expect(editor.canUndo()).toBe(false);
    refused(deck, 'invalid', () => {
      editor.setTableDisplay({ detail: 'auto' as never });
    });
    refused(deck, 'invalid', () => {
      editor.setTableDisplay({ showTypes: true } as never);
    });
  });

  it('sets and clears an enum colour (updateEnum)', () => {
    const { editor, deck } = setup();
    oneStep(editor, deck, () => {
      editor.updateEnum('e-status', { color: 'teal' });
    });
    expect(deck().enums?.[0]?.color).toBe('teal');
    editor.updateEnum('e-status', { color: '#112233' });
    expect(deck().enums?.[0]?.color).toBe('#112233');
    editor.updateEnum('e-status', { color: null });
    expect(deck().enums?.[0]).not.toHaveProperty('color');
    refused(deck, 'invalid', () => {
      editor.updateEnum('e-status', { color: 'purple-ish' });
    });
  });
});

describe('change events and the snapshot (040)', () => {
  it('keeps the incremental snapshot equal to toJSON through every database op', () => {
    const { editor, doc } = setup();
    const snapshot = createDeckSnapshot(doc);
    const steps: (() => unknown)[] = [
      () => editor.addColumn('orders', { name: 'note', type: 'text' }),
      () => {
        editor.updateColumn('orders', 'o-total', { name: 'amount', notNull: true });
      },
      () => {
        editor.moveColumn('orders', 'o-total', 0);
      },
      () => editor.addIndex('orders', { columns: ['o-id'] }),
      () => editor.removeColumn('items', 'i-order'),
      () => editor.addEnum({ name: 'mood', values: [{ name: 'ok' }] }),
      () => {
        editor.updateEnumValue('e-status', 'ev-active', { name: 'enabled' });
      },
      () => editor.removeEnum('e-status'),
      () => {
        editor.setDialect(null);
      },
      () => {
        editor.update('edges', 'r-cat-parent', { cardinality: 'n-1' });
      },
      () => {
        editor.setTableDisplay({ detail: 'keys', hideNotes: true });
      },
      () => {
        editor.setTableDisplay({ detail: null, hideNotes: false });
      },
    ];
    for (const step of steps) {
      step();
      expect(snapshot.get()).toEqual(toJSON(doc));
    }
    snapshot.destroy();
  });

  it('reports a column edit as an update of the table, and enum edits as meta', () => {
    const { editor, doc } = setup();
    const seen: string[] = [];
    const stop = observeDeck(doc, ({ changes }) => {
      for (const c of changes) seen.push(`${c.scope}:${c.id}:${c.kind}:${c.keys.join(',')}`);
    });
    editor.updateColumn('orders', 'o-total', { name: 'amount' });
    editor.updateEnumValue('e-status', 'ev-active', { name: 'enabled' });
    editor.setDialect('mysql');
    stop();
    expect(seen).toEqual([
      'nodes:orders:updated:columns',
      'meta::updated:enums',
      'meta::updated:dialect',
    ]);
  });
});
