import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  checkDeck,
  copyName,
  createEditor,
  fromJSON,
  getObject,
  parseFragment,
  serializeFragment,
  toFragment,
  toJSON,
  type Fragment,
} from '../src';
import { expectValid, largeSchemaDeck, seqIds, shopDeck } from './helpers';

const source: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    {
      id: 'a',
      type: 'service',
      title: 'A',
      group: 'inner',
      position: { x: 0, y: 0 },
      rules: ['R', 'Gone'],
    },
    { id: 'b', type: 'service', title: 'B', group: 'inner', position: { x: 200, y: 0 } },
    {
      id: 'c',
      type: 'database',
      title: 'C',
      group: 'outer',
      parent: 'b',
      position: { x: 0, y: 200 },
    },
  ],
  groups: [
    {
      id: 'outer',
      title: 'Outer',
      position: { x: -48, y: -48 },
      size: { width: 500, height: 400 },
    },
    {
      id: 'inner',
      title: 'Inner',
      parent: 'outer',
      position: { x: -24, y: -24 },
      size: { width: 420, height: 152 },
    },
  ],
  edges: [
    { id: 'ab', from: 'a', to: 'b', label: 'call' },
    { id: 'bc', from: 'b', to: 'c' },
  ],
  rules: { R: { title: 'R', hitPolicy: 'first', inputs: [], outputs: [], rows: [] } },
};

const whole = toFragment(source, { nodes: ['a', 'b', 'c'], groups: ['outer', 'inner'] });
const offset = { x: 100, y: 50 };

function setup(file: SododeckFile = source) {
  const doc = fromJSON(file);
  return { doc, editor: createEditor(doc, { newId: seqIds() }) };
}

describe('pasteFragment (016 R10)', () => {
  it('adds copies with new ids that collide with nothing, and returns them', () => {
    const { doc, editor } = setup();
    const ids = editor.pasteFragment(whole, { offset });
    const deck = toJSON(doc);
    expect(deck.nodes).toHaveLength(6);
    expect(deck.edges).toHaveLength(4);
    expect(deck.groups).toHaveLength(4);
    const all = [...deck.nodes, ...deck.edges, ...deck.groups].map((o) => o.id);
    expect(new Set(all).size).toBe(all.length);
    expect(ids.nodes).toHaveLength(3);
    expect(ids.edges).toHaveLength(2);
    expect(ids.groups).toHaveLength(2);
    for (const id of [...ids.nodes, ...ids.edges, ...ids.groups]) {
      expect(['a', 'b', 'c', 'ab', 'bc', 'outer', 'inner']).not.toContain(id);
    }
    expectValid(doc);
  });

  it('remaps edges, groups, parents and nested groups inside the set', () => {
    const { doc, editor } = setup();
    const ids = editor.pasteFragment(whole, { offset });
    const [a, b, c] = ids.nodes.map((id) => getObject(doc, 'nodes', id));
    const [outer, inner] = ids.groups.map((id) => getObject(doc, 'groups', id));
    const [ab, bc] = ids.edges.map((id) => getObject(doc, 'edges', id));
    expect(ab).toMatchObject({ from: a?.id, to: b?.id, label: 'call' });
    expect(bc).toMatchObject({ from: b?.id, to: c?.id });
    expect(a?.group).toBe(inner?.id);
    expect(c?.group).toBe(outer?.id);
    expect(c?.parent).toBe(b?.id);
    expect(inner?.parent).toBe(outer?.id);
    expect(outer).not.toHaveProperty('parent');
  });

  it('puts what came from outside the set into options.parent', () => {
    const { doc, editor } = setup();
    const partial = toFragment(source, { nodes: ['a', 'b'], groups: [] });
    const ids = editor.pasteFragment(partial, { offset, parent: 'outer' });
    for (const id of ids.nodes) expect(getObject(doc, 'nodes', id)?.group).toBe('outer');
    const nested = toFragment(source, { nodes: ['a', 'b'], groups: ['inner'] });
    const again = editor.pasteFragment(nested, { offset, parent: 'outer' });
    expect(getObject(doc, 'groups', again.groups[0] ?? '')?.parent).toBe('outer');
    const top = editor.pasteFragment(nested, { offset });
    expect(getObject(doc, 'groups', top.groups[0] ?? '')).not.toHaveProperty('parent');
  });

  it('drops rule ids the deck does not have', () => {
    const { doc, editor } = setup();
    const ids = editor.pasteFragment(whole, { offset });
    expect(getObject(doc, 'nodes', ids.nodes[0] ?? '')?.rules).toEqual(['R']);
    const other = setup({ ...emptySododeckFile() });
    const pasted = other.editor.pasteFragment(whole, { offset });
    expect(getObject(other.doc, 'nodes', pasted.nodes[0] ?? '')).not.toHaveProperty('rules');
    expectValid(other.doc);
  });

  it('offsets positions and frames', () => {
    const { doc, editor } = setup();
    const ids = editor.pasteFragment(whole, { offset });
    expect(getObject(doc, 'nodes', ids.nodes[1] ?? '')?.position).toEqual({ x: 300, y: 50 });
    expect(getObject(doc, 'groups', ids.groups[0] ?? '')).toMatchObject({
      position: { x: 52, y: 2 },
      size: { width: 500, height: 400 },
    });
  });

  it('writes view positions and frames as well in a non-base view', () => {
    const { doc, editor } = setup({
      ...source,
      views: [
        { id: 'v1', type: 'system', title: 'One' },
        { id: 'v2', type: 'infra', title: 'Two', positions: { a: { x: 9, y: 9 } } },
      ],
    });
    const ids = editor.pasteFragment(whole, { offset, viewId: 'v2' });
    const view = getObject(doc, 'views', 'v2');
    const node = ids.nodes[1] ?? '';
    const group = ids.groups[0] ?? '';
    expect(view?.positions?.[node]).toEqual({ x: 300, y: 50 });
    expect(getObject(doc, 'nodes', node)?.position).toEqual({ x: 300, y: 50 });
    expect(view?.groupFrames?.[group]).toEqual({
      position: { x: 52, y: 2 },
      size: { width: 500, height: 400 },
    });
    expectValid(doc);
  });

  it('is one undo step', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    editor.pasteFragment(whole, { offset });
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('refuses an unknown parent without writing', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    expect(() => editor.pasteFragment(whole, { offset, parent: 'nope' })).toThrow();
    expect(toJSON(doc)).toEqual(before);
  });

  it('pastes an empty fragment as nothing', () => {
    const { editor } = setup();
    const empty = toFragment(source, { nodes: [], groups: [] });
    expect(editor.pasteFragment(empty, { offset })).toEqual({
      nodes: [],
      edges: [],
      groups: [],
      droppedRelationships: 0,
    });
    expect(editor.canUndo()).toBe(false);
  });
});

describe('connector style on copy and create (022 FR-005a)', () => {
  const styled: SododeckFile = {
    ...source,
    edges: [
      {
        id: 'ab',
        from: 'a',
        to: 'b',
        style: { dash: 'dashed', width: 3, color: 'blue', animated: true },
        route: { fromSide: 'right', fromAt: 0.25, waypoints: [{ x: 0.5, dy: -20 }] },
        labelAt: 0.2,
      },
    ],
  };

  it('a pasted connector keeps its style, bends, anchors and label position', () => {
    const doc = fromJSON(styled);
    const editor = createEditor(doc, { newId: seqIds() });
    const fragment = toFragment(styled, { nodes: ['a', 'b'], groups: [] });
    editor.pasteFragment(fragment, { offset: { x: 50, y: 50 } });
    const copy = toJSON(doc).edges.find((edge) => edge.id !== 'ab');
    expect(copy?.style).toEqual(styled.edges[0]?.style);
    expect(copy?.route).toEqual(styled.edges[0]?.route);
    expect(copy?.labelAt).toBe(0.2);
    expectValid(doc);
  });

  it('a newly created connector has no style', () => {
    const doc = fromJSON(styled);
    const editor = createEditor(doc, { newId: seqIds() });
    const id = editor.add('edges', { from: 'b', to: 'c' });
    expect(getObject(doc, 'edges', id)).not.toHaveProperty('style');
  });
});

describe('typed values on the clipboard (032 FR-021)', () => {
  const withValues: SododeckFile = {
    ...emptySododeckFile(),
    fields: [{ id: 'zone', name: 'Zone', kind: 'text', types: ['warehouse'] }],
    nodes: [
      {
        id: 'w',
        type: 'warehouse',
        title: 'Hub',
        values: { zone: 'Cold', 'warehouse.capacity': 40 },
        position: { x: 0, y: 0 },
      },
    ],
  };

  it('keeps values on a duplicate in the same deck', () => {
    const doc = fromJSON(withValues);
    const editor = createEditor(doc, { newId: seqIds() });
    const fragment = toFragment(toJSON(doc), { nodes: ['w'], groups: [] });
    const { nodes } = editor.pasteFragment(fragment, { offset: { x: 24, y: 24 } });
    expect(getObject(doc, 'nodes', nodes[0] ?? '')?.values).toEqual({
      zone: 'Cold',
      'warehouse.capacity': 40,
    });
  });

  it('keeps values pasted into a deck without the field, inventing no definition', () => {
    const fragment = toFragment(withValues, { nodes: ['w'], groups: [] });
    const doc = fromJSON(emptySododeckFile());
    const editor = createEditor(doc, { newId: seqIds() });
    const { nodes } = editor.pasteFragment(fragment, { offset: { x: 0, y: 0 } });
    const id = nodes[0] ?? '';
    expect(getObject(doc, 'nodes', id)?.values).toEqual({ zone: 'Cold', 'warehouse.capacity': 40 });
    expect(toJSON(doc).fields).toBeUndefined();
    const problems = checkDeck(toJSON(doc)).list;
    expect(problems.map((p) => [p.kind, p.key])).toEqual([
      ['field-value-dangling', `field-value-dangling:${id}:zone`],
    ]);
    expectValid(doc);
  });
});

describe('pasting tables (040 FR-022a)', () => {
  const shop = shopDeck();
  const fragment = toFragment(shop, { nodes: ['shipments', 'items', 'orders'], groups: [] });

  it('copies table lists and relationships with column ends into the fragment', () => {
    const items = fragment.deck.nodes.find((n) => n.id === 'items');
    expect(items?.columns?.map((c) => c.id)).toEqual(['i-order', 'i-line', 'i-qty']);
    expect(fragment.deck.edges.map((e) => e.id)).toEqual(['r-ship-item']);
  });

  it('gives every column, index and check a new id and remaps index parts and column ends', () => {
    const doc = fromJSON(shop);
    const editor = createEditor(doc, { newId: seqIds() });
    const before = toJSON(doc);
    const pasted = editor.pasteFragment(fragment, { offset: { x: 40, y: 40 } });
    const deck = toJSON(doc);
    expectValid(doc);
    // Taken table names get `_copy` since 043 (FR-020).
    const copyOf = (title: string) =>
      deck.nodes.find((n) => n.title === `${title}_copy` && pasted.nodes.includes(n.id));
    const orders = copyOf('orders');
    const items = copyOf('order_items');
    const shipments = copyOf('shipments');
    const oldIds = new Set(
      before.nodes.flatMap((n) => [
        ...(n.columns ?? []).map((c) => c.id),
        ...(n.indexes ?? []).map((i) => i.id),
        ...(n.checks ?? []).map((c) => c.id),
      ]),
    );
    const newIds = [orders, items, shipments].flatMap((n) => [
      ...(n?.columns ?? []).map((c) => c.id),
      ...(n?.indexes ?? []).map((i) => i.id),
      ...(n?.checks ?? []).map((c) => c.id),
    ]);
    expect(newIds).toHaveLength(13);
    for (const id of newIds) expect(oldIds.has(id)).toBe(false);
    const orderColumns = (orders?.columns ?? []).map((c) => c.id);
    expect(orders?.indexes?.[1]?.columns).toEqual([orderColumns[1], orderColumns[2]]);
    expect(orders?.indexes?.[2]?.columns).toEqual([{ expr: 'lower(note)' }]);
    const relation = deck.edges.find((e) => e.id === pasted.edges[0]);
    expect(relation?.fromColumns).toEqual((shipments?.columns ?? []).slice(1).map((c) => c.id));
    expect(relation?.toColumns).toEqual((items?.columns ?? []).slice(0, 2).map((c) => c.id));
    // The originals keep their ids; one undo removes the paste.
    expect(deck.nodes.slice(0, before.nodes.length)).toEqual(before.nodes);
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(before);
  });

  it('keeps enumRef as it is (enums are deck-level)', () => {
    const doc = fromJSON(shop);
    const editor = createEditor(doc, { newId: seqIds() });
    const copy = toFragment(shop, { nodes: ['customers'], groups: [] });
    const [id] = editor.pasteFragment(copy, { offset: { x: 0, y: 0 } }).nodes;
    const pasted = toJSON(doc).nodes.find((n) => n.id === id);
    expect(pasted?.columns?.[2]?.enumRef).toBe('e-status');
  });
});

describe('pasting group-ended edges (050)', () => {
  const grouped: SododeckFile = {
    ...source,
    edges: [
      ...source.edges,
      { id: 'a-inner', from: 'a', to: 'inner', style: { dash: 'dotted' } },
      { id: 'inner-outer', from: 'inner', to: 'outer', route: { fromSide: 'right' } },
    ],
  };

  it('remaps group ends to the pasted groups', () => {
    const { doc, editor } = setup(grouped);
    const fragment = toFragment(grouped, { nodes: ['a', 'b', 'c'], groups: ['outer', 'inner'] });
    const ids = editor.pasteFragment(fragment, { offset });
    const [a] = ids.nodes.map((id) => getObject(doc, 'nodes', id));
    const [outer, inner] = ids.groups.map((id) => getObject(doc, 'groups', id));
    const edges = ids.edges.map((id) => getObject(doc, 'edges', id));
    expect(edges).toHaveLength(4);
    expect(edges[2]).toMatchObject({ from: a?.id, to: inner?.id, style: { dash: 'dotted' } });
    expect(edges[3]).toMatchObject({
      from: inner?.id,
      to: outer?.id,
      route: { fromSide: 'right' },
    });
    expectValid(doc);
    expect(checkDeck(toJSON(doc)).list.filter((p) => p.kind === 'broken-reference')).toEqual([]);
  });
});

describe('duplicate and paste of tables (043 R10)', () => {
  const shop = shopDeck();
  const copyOf = (nodes: string[]) =>
    toFragment(shop, { nodes, groups: [] }, { keepOutgoing: true });
  const setupDeck = (file: SododeckFile) => {
    const doc = fromJSON(file);
    return { doc, editor: createEditor(doc, { newId: seqIds() }) };
  };
  const at = { offset: { x: 40, y: 40 } };
  const nodeOf = (file: SododeckFile, id: string | undefined) =>
    file.nodes.find((n) => n.id === id);

  it('puts outgoing relationships in external and referenced enums in enums', () => {
    const fragment = copyOf(['orders', 'shipments', 'customers']);
    expect(fragment.deck.edges.map((e) => e.id)).toEqual(['r-orders-customer']);
    expect(fragment.external?.map((e) => e.id)).toEqual(['r-ship-item']);
    expect(fragment.enums?.map((e) => e.id)).toEqual(['e-status']);
    // Without keepOutgoing nothing leaves the fragment; a deck without enums carries none.
    const plain = toFragment(shop, { nodes: ['orders', 'shipments'], groups: [] });
    expect(plain).not.toHaveProperty('external');
    expect(plain).not.toHaveProperty('enums');
    expect(copyOf(['items'])).not.toHaveProperty('external');
  });

  it('never copies incoming relationships', () => {
    const fragment = copyOf(['customers']);
    expect(fragment.deck.edges).toEqual([]);
    expect(fragment).not.toHaveProperty('external');
    const { doc, editor } = setupDeck(shop);
    const pasted = editor.pasteFragment(fragment, at);
    expect(pasted.edges).toEqual([]);
    expect(toJSON(doc).edges).toHaveLength(shop.edges.length);
  });

  it('keeps external relationships in the same deck, remapped on the from side', () => {
    const { doc, editor } = setupDeck(shop);
    const pasted = editor.pasteFragment(copyOf(['orders']), at);
    expect(pasted.droppedRelationships).toBe(0);
    const deck = toJSON(doc);
    const orders = nodeOf(deck, pasted.nodes[0]);
    const edge = deck.edges.find((e) => e.id === pasted.edges[0]);
    expect(edge).toMatchObject({
      from: orders?.id,
      to: 'customers',
      fromColumns: [orders?.columns?.[1]?.id],
      toColumns: ['c-id'],
      cardinality: 'n-1',
      onDelete: 'cascade',
    });
    expect(edge?.id).not.toBe('r-orders-customer');
    expectValid(doc);
    expect(checkDeck(deck).list.filter((p) => p.kind === 'broken-reference')).toEqual([]);
  });

  it('drops external relationships whose target or its columns are missing, and counts them', () => {
    const fragment = copyOf(['orders', 'shipments']);
    const empty = setupDeck(emptySododeckFile());
    const pasted = empty.editor.pasteFragment(fragment, at);
    expect(pasted.droppedRelationships).toBe(2);
    expect(pasted.edges).toEqual([]);
    expect(toJSON(empty.doc).edges).toEqual([]);
    expectValid(empty.doc);
    // The target exists but lacks the column: dropped too.
    const lacking = setupDeck({
      ...emptySododeckFile(),
      nodes: [
        {
          id: 'customers',
          type: 'db-table',
          title: 'customers',
          columns: [{ id: 'other', name: 'id', type: 'bigint' }],
        },
      ],
    });
    expect(lacking.editor.pasteFragment(copyOf(['orders']), at).droppedRelationships).toBe(1);
  });

  it('remaps a self-reference to the copy', () => {
    const { doc, editor } = setupDeck(shop);
    const pasted = editor.pasteFragment(copyOf(['categories']), at);
    const deck = toJSON(doc);
    const copy = nodeOf(deck, pasted.nodes[0]);
    const edge = deck.edges.find((e) => e.id === pasted.edges[0]);
    expect(edge).toMatchObject({
      from: copy?.id,
      to: copy?.id,
      fromColumns: [copy?.columns?.[1]?.id],
      toColumns: [copy?.columns?.[0]?.id],
      fromOptional: true,
    });
  });

  it('links two copied tables to each other', () => {
    const { doc, editor } = setupDeck(emptySododeckFile());
    const pasted = editor.pasteFragment(copyOf(['shipments', 'items']), at);
    expect(pasted.droppedRelationships).toBe(0);
    const deck = toJSON(doc);
    const [items, shipments] = pasted.nodes.map((id) => nodeOf(deck, id));
    expect(deck.edges).toHaveLength(1);
    expect(deck.edges[0]).toMatchObject({ from: shipments?.id, to: items?.id });
    expectValid(doc);
  });

  it('links an enum by name, ignoring case, in the same schema', () => {
    const target: SododeckFile = {
      ...emptySododeckFile(),
      enums: [
        { id: 'other-schema', name: 'customer_status', schema: 'billing', values: [] },
        { id: 'mine', name: 'Customer_Status', values: [{ id: 'mine-a', name: 'active' }] },
      ],
    };
    const { doc, editor } = setupDeck(target);
    const pasted = editor.pasteFragment(copyOf(['customers', 'categories']), at);
    const deck = toJSON(doc);
    expect(deck.enums).toEqual(target.enums);
    expect(nodeOf(deck, pasted.nodes[0])?.columns?.[2]?.enumRef).toBe('mine');
    expect(nodeOf(deck, pasted.nodes[1])?.columns?.[1]?.enumRef).toBe('mine');
    expectValid(doc);
  });

  it('copies a missing enum once, with new enum and value ids', () => {
    const { doc, editor } = setupDeck({
      ...emptySododeckFile(),
      enums: [{ id: 'billing', name: 'customer_status', schema: 'billing', values: [] }],
    });
    const pasted = editor.pasteFragment(copyOf(['customers', 'categories']), at);
    const deck = toJSON(doc);
    expect(deck.enums).toHaveLength(2);
    const copy = deck.enums?.[1];
    expect(copy?.name).toBe('customer_status');
    expect(copy).not.toHaveProperty('schema');
    expect(copy?.values.map((v) => v.name)).toEqual(['active', 'blocked']);
    expect(copy?.values[1]?.note).toBe('No orders.');
    const oldIds = ['e-status', 'ev-active', 'ev-blocked'];
    for (const id of [copy?.id, ...(copy?.values ?? []).map((v) => v.id)]) {
      expect(oldIds).not.toContain(id);
    }
    expect(nodeOf(deck, pasted.nodes[0])?.columns?.[2]?.enumRef).toBe(copy?.id);
    expect(nodeOf(deck, pasted.nodes[1])?.columns?.[1]?.enumRef).toBe(copy?.id);
    expectValid(doc);
    expect(checkDeck(deck).list.filter((p) => p.kind === 'db-dangling-reference')).toEqual([]);
  });

  it('renames taken table names to _copy, then _copy_2, ignoring case, in the same schema', () => {
    const { doc, editor } = setupDeck(shop);
    const first = editor.pasteFragment(copyOf(['orders', 'db']), at);
    const second = editor.pasteFragment(copyOf(['orders']), at);
    const deck = toJSON(doc);
    expect(nodeOf(deck, first.nodes[0])?.title).toBe('Shop');
    expect(nodeOf(deck, first.nodes[1])?.title).toBe('orders_copy');
    expect(nodeOf(deck, second.nodes[0])?.title).toBe('orders_copy_2');

    const other = setupDeck({
      ...emptySododeckFile(),
      nodes: [
        { id: 'up', type: 'db-table', title: 'ORDERS' },
        { id: 'billing', type: 'db-table', title: 'customers', schema: 'billing' },
        { id: 'card', type: 'service', title: 'shipments' },
      ],
    });
    const pasted = other.editor.pasteFragment(copyOf(['orders', 'customers', 'shipments']), at);
    const titles = pasted.nodes.map((id) => nodeOf(toJSON(other.doc), id)?.title);
    expect(titles).toEqual(['customers', 'orders_copy', 'shipments']);
  });

  it('copyName adds _copy, then _copy_2 and up, ignoring case', () => {
    expect(copyName('orders', new Set(['orders']))).toBe('orders_copy');
    expect(copyName('orders', new Set(['orders', 'ORDERS_COPY']))).toBe('orders_copy_2');
    expect(copyName('orders', new Set(['orders_copy', 'orders_copy_2']))).toBe('orders_copy_3');
  });

  it('gives 20 pasted tables no id shared with the originals', () => {
    const file = largeSchemaDeck(30, 4, 40);
    const tables = file.nodes.slice(0, 20).map((n) => n.id);
    const fragment = toFragment(file, { nodes: tables, groups: [] }, { keepOutgoing: true });
    expect(fragment.external?.length ?? 0).toBeGreaterThan(0);
    const idsOf = (deck: SododeckFile) =>
      new Set([
        ...deck.nodes.flatMap((n) => [
          n.id,
          ...(n.columns ?? []).map((c) => c.id),
          ...(n.indexes ?? []).map((i) => i.id),
          ...(n.checks ?? []).map((c) => c.id),
        ]),
        ...deck.edges.map((e) => e.id),
        ...(deck.enums ?? []).flatMap((e) => [e.id, ...e.values.map((v) => v.id)]),
      ]);
    const original = idsOf(file);
    for (const target of [file, emptySododeckFile()]) {
      const { doc, editor } = setupDeck(target);
      const before = idsOf(target);
      const pasted = editor.pasteFragment(fragment, at);
      const added = [...idsOf(toJSON(doc))].filter((id) => !before.has(id));
      expect(pasted.nodes).toHaveLength(20);
      expect(added.length).toBeGreaterThan(20 * 7);
      expect(added.filter((id) => original.has(id))).toEqual([]);
      expectValid(doc);
    }
  });

  it('pastes an old fragment without external or enums as before', () => {
    const old = JSON.stringify({
      sododeckFragment: 1,
      deck: toFragment(shop, { nodes: ['customers', 'orders'], groups: [] }).deck,
    });
    const parsed = parseFragment(old);
    expect(parsed).not.toBeNull();
    if (parsed === null) return;
    const { doc, editor } = setupDeck(shop);
    const pasted = editor.pasteFragment(parsed, at);
    expect(pasted.droppedRelationships).toBe(0);
    expect(pasted.edges).toHaveLength(1);
    expect(nodeOf(toJSON(doc), pasted.nodes[0])?.columns?.[2]?.enumRef).toBe('e-status');
    expect(toJSON(doc).enums).toEqual(shop.enums);
  });

  it('serializes and parses external and enums, and refuses bad ones', () => {
    const fragment = copyOf(['orders', 'customers', 'shipments']);
    expect(parseFragment(serializeFragment(fragment))).toEqual(fragment);
    const raw = JSON.parse(serializeFragment(fragment)) as Record<string, unknown>;
    const bad = (patch: Record<string, unknown>) =>
      parseFragment(JSON.stringify({ ...raw, ...patch }));
    expect(bad({ external: [{ id: 'x', from: 'orders' }] })).toBeNull();
    expect(bad({ external: 'nope' })).toBeNull();
    expect(bad({ enums: [{ id: 'e', name: 'e' }] })).toBeNull();
    expect(bad({ enums: [shop.enums?.[0], shop.enums?.[0]] })).toBeNull();
  });

  it('is one undo step, enums included', () => {
    const { doc, editor } = setupDeck(emptySododeckFile());
    const before = toJSON(doc);
    const fragment: Fragment = copyOf(['customers', 'orders']);
    editor.pasteFragment(fragment, at);
    expect(toJSON(doc).enums).toHaveLength(1);
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });
});
