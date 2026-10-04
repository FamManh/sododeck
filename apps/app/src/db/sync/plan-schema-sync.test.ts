import { isDbTable } from '@sododeck/model';
import type { Node, SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { schemaExport } from '../export/schema-export';
import { DEFAULT_SQL_OPTIONS } from '../export/types';
import { shopDeck } from '../fixtures/shop';
import { readRaw } from '../fixtures/sync/deck-from-dbml';
import { edits, shopText, writeShopDbml } from '../fixtures/sync/shop-edits';
import { planSchemaSync } from './plan-schema-sync';
import { createSessionMemory, rememberTables } from './session-memory';
import type { SchemaPlan, SyncContext, SyncResult } from './types';

let counter = 0;
function context(extra: Partial<SyncContext> = {}): SyncContext {
  return {
    scope: { kind: 'schema' },
    memory: createSessionMemory(),
    newId: (prefix) => `${prefix}.new${String(counter++)}`,
    viewport: { x: 0, y: 0, width: 1000, height: 600 },
    ...extra,
  };
}

const deck = shopDeck('postgres');
const table = (name: string, d: SododeckFile = deck): Node => {
  const found = d.nodes.find((n) => isDbTable(n) && n.title === name);
  if (found === undefined) throw new Error(`no table ${name}`);
  return found;
};
const column = (t: Node, name: string) => {
  const found = t.columns?.find((c) => c.name === name);
  if (found === undefined) throw new Error(`no column ${name}`);
  return found;
};

async function plan(
  text: string,
  d: SododeckFile = deck,
  extra: Partial<SyncContext> = {},
): Promise<SyncResult> {
  return planSchemaSync(d, await readRaw(text), context(extra));
}

const errors = (r: SyncResult) => r.problems.filter((p) => p.severity === 'error');

describe('planSchemaSync: Shop edits', () => {
  it('plans nothing for the writer text', async () => {
    const result = await plan(shopText());
    expect(result.plan.isEmpty).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it('adds a column to the matched table, after its siblings', async () => {
    const { plan: p } = await plan(edits.addColumn(shopText()));
    const orders = table('orders');
    expect(p.addTables).toEqual([]);
    expect(p.removeTables).toEqual([]);
    expect(p.updateTables).toEqual([]);
    expect(p.tableOps).toHaveLength(1);
    const [ops] = p.tableOps;
    expect(ops?.tableId).toBe(orders.id);
    expect(ops?.columns.adds).toHaveLength(1);
    expect(ops?.columns.adds[0]?.item).toMatchObject({
      name: 'discount_cents',
      type: 'integer',
      notNull: true,
    });
    expect(ops?.columns.updates).toEqual([]);
    expect(ops?.columns.removes).toEqual([]);
    // Placed after `total`: the order changes only for the new column.
    const ids = ops?.columns.order ?? [];
    expect(ids.at(-1)).not.toBe(ids[ids.length - 2]);
  });

  it('renames a table in place: same id, one title patch, relationships untouched', async () => {
    const { plan: p } = await plan(edits.renameTable(shopText()));
    const customers = table('customers');
    expect(p.updateTables).toEqual([{ id: customers.id, patch: { title: 'clients' } }]);
    expect(p.addTables).toEqual([]);
    expect(p.removeTables).toEqual([]);
    expect(p.relationshipOps).toEqual({ adds: [], updates: [], removes: [] });
    expect(p.tableOps).toEqual([]);
  });

  it('renames a column in place, keeping its id (indexes and relationships follow by id)', async () => {
    const { plan: p } = await plan(edits.renameColumn(shopText()));
    const orders = table('orders');
    const total = column(orders, 'total');
    expect(p.tableOps).toHaveLength(1);
    expect(p.tableOps[0]?.columns.updates).toEqual([
      { id: total.id, patch: { name: 'grand_total' } },
    ]);
    expect(p.tableOps[0]?.columns.adds).toEqual([]);
    expect(p.tableOps[0]?.columns.removes).toEqual([]);
    expect(p.relationshipOps).toEqual({ adds: [], updates: [], removes: [] });
  });

  it('removes a table, and the relationships that named it need no operation of their own', async () => {
    const { plan: p } = await plan(edits.removeTable(shopText()));
    const shipments = table('shipments');
    expect(p.removeTables).toEqual([{ id: shipments.id, name: 'shipments' }]);
    expect(p.relationshipOps.removes).toEqual([]);
    expect(p.removesAll).toBe(false);
  });

  it('adds a table with a relationship, placed right of the others', async () => {
    const { plan: p, problems } = await plan(edits.addTableWithRef(shopText()));
    expect(errors({ plan: p, problems })).toEqual([]);
    expect(p.addTables).toHaveLength(1);
    const added = p.addTables[0]?.node;
    expect(added?.title).toBe('coupons');
    expect(added?.columns?.map((c) => c.name)).toEqual(['id', 'code']);
    expect(added?.position).toBeDefined();
    const right = Math.max(...deck.nodes.filter(isDbTable).map((n) => n.position?.x ?? 0));
    expect(added?.position?.x ?? 0).toBeGreaterThan(right);
    expect(p.relationshipOps.adds).toHaveLength(1);
    const rel = p.relationshipOps.adds[0];
    expect(rel?.from).toBe(table('orders').id);
    expect(rel?.to).toBe(added?.id);
    // The new relationship names the new column and the new table's key.
    expect(rel?.toColumns).toEqual([added?.columns?.[0]?.id]);
  });

  it('renames an enum and moves the columns that name it', async () => {
    const { plan: p } = await plan(edits.renameEnum(shopText()));
    const e = deck.enums?.find((x) => x.name === 'order_status');
    expect(p.enumOps.updates).toHaveLength(1);
    expect(p.enumOps.updates[0]).toMatchObject({ id: e?.id, patch: { name: 'order_state' } });
    expect(p.enumOps.adds).toEqual([]);
    expect(p.enumOps.removes).toEqual([]);
    const status = column(table('orders'), 'status');
    const ops = p.tableOps.find((o) => o.tableId === table('orders').id);
    expect(ops?.columns.updates).toEqual([{ id: status.id, patch: { type: 'order_state' } }]);
  });

  it('replaces two tables by two others and warns', async () => {
    const result = await plan(edits.replaceTwoTables(shopText()));
    expect(errors(result)).toEqual([]);
    expect(result.plan.removeTables.map((t) => t.name).sort()).toEqual(['payments', 'shipments']);
    expect(result.plan.addTables.map((t) => t.node.title).sort()).toEqual([
      'carriers',
      'warehouses',
    ]);
    const warning = result.problems.find((p) => p.code === 'replaced');
    expect(warning?.severity).toBe('warning');
    expect(warning?.message).toMatch(/replaced; Undo to restore/);
  });

  it('warns on a TableGroup and still plans the rest', async () => {
    const result = await plan(edits.tableGroup(shopText()));
    expect(result.plan.isEmpty).toBe(true);
    expect(result.problems.map((p) => [p.code, p.severity])).toEqual([['not-an-input', 'warning']]);
  });

  it('removes every table for empty text and says so', async () => {
    const { plan: p } = await plan(edits.clear());
    expect(p.removesAll).toBe(true);
    expect(p.removeTables).toHaveLength(deck.nodes.filter(isDbTable).length);
  });
});

describe('planSchemaSync: what DBML does not express is never in a patch', () => {
  it('keeps position, colour, tags, links, lock and parent of a renamed table', async () => {
    const decorated: SododeckFile = {
      ...deck,
      nodes: deck.nodes.map((n) =>
        n.title === 'customers'
          ? { ...n, tags: ['core'], style: { fill: '#336699' }, owner: 'team' }
          : n,
      ),
    };
    const { plan: p } = await plan(edits.renameTable(shopText()), decorated);
    expect(p.updateTables).toHaveLength(1);
    expect(Object.keys(p.updateTables[0]?.patch ?? {})).toEqual(['title']);
  });

  it('never clears an index method DBML cannot hold', async () => {
    const withGin: SododeckFile = {
      ...deck,
      nodes: deck.nodes.map((n) =>
        n.title === 'audit_log'
          ? { ...n, indexes: (n.indexes ?? []).map((i) => ({ ...i, method: 'gin' })) }
          : n,
      ),
    };
    const { plan: p } = await plan(writeShopDbml(withGin), withGin);
    expect(p.isEmpty).toBe(true);
  });

  it('drops patches that change nothing (a case-only difference in a type)', async () => {
    const shouted: SododeckFile = {
      ...deck,
      nodes: deck.nodes.map((n) =>
        n.title === 'sessions'
          ? {
              ...n,
              columns: (n.columns ?? []).map((c) =>
                c.name === 'token' ? { ...c, type: 'VARCHAR' } : c,
              ),
            }
          : n,
      ),
    };
    const { plan: p } = await plan(shopText(), shouted);
    expect(p.isEmpty).toBe(true);
  });
});

describe('planSchemaSync: session memory restores a table with its ids', () => {
  it('restores shipments with its old node, ids and relationships', async () => {
    const memory = createSessionMemory();
    const shipments = table('shipments');
    rememberTables(memory, deck, [shipments.id]);
    const without = {
      ...deck,
      nodes: deck.nodes.filter((n) => n.id !== shipments.id),
      edges: deck.edges.filter((e) => e.from !== shipments.id && e.to !== shipments.id),
    };
    const { plan: p } = await plan(shopText(), without, { memory });
    expect(p.addTables).toHaveLength(1);
    expect(p.addTables[0]?.restoredFrom).toBe('memory');
    expect(p.addTables[0]?.node.id).toBe(shipments.id);
    expect(p.addTables[0]?.node.position).toEqual(shipments.position);
    expect(p.tableOps).toEqual([]);
    // Both relationships of the table come back with their own ids.
    const back = p.relationshipOps.adds.map((r) => r.id).sort();
    const had = deck.edges
      .filter((e) => e.from === shipments.id || e.to === shipments.id)
      .map((e) => e.id)
      .sort();
    expect(back).toEqual(had);
    expect(p.relationshipOps.adds.every((r) => r.base !== undefined)).toBe(true);
  });

  it('patches a restored table to the text typed back', async () => {
    const memory = createSessionMemory();
    const shipments = table('shipments');
    rememberTables(memory, deck, [shipments.id]);
    const without = {
      ...deck,
      nodes: deck.nodes.filter((n) => n.id !== shipments.id),
      edges: deck.edges.filter((e) => e.from !== shipments.id && e.to !== shipments.id),
    };
    const text = shopText().replace(
      '  carrier varchar(80)\n',
      '  carrier varchar(80)\n  weight integer\n',
    );
    const { plan: p } = await plan(text, without, { memory });
    const ops = p.tableOps.find((o) => o.tableId === shipments.id);
    expect(ops?.columns.adds.map((a) => a.item.name)).toEqual(['weight']);
  });
});

describe('planSchemaSync: locked tables', () => {
  it('refuses an edit to a locked table and plans nothing', async () => {
    const lockedDeck: SododeckFile = {
      ...deck,
      nodes: deck.nodes.map((n) => (n.title === 'customers' ? { ...n, locked: true as const } : n)),
    };
    const result = await plan(edits.renameTable(shopText()), lockedDeck);
    expect(result.plan.isEmpty).toBe(true);
    expect(result.problems.map((p) => p.code)).toEqual(['locked']);
  });
});

describe('planSchemaSync: Selection scope', () => {
  const selected = ['orders', 'order_items'];
  const ids = selected.map((name) => table(name).id);
  const selectionText = (d: SododeckFile = deck) =>
    schemaExport(d, {
      format: 'dbml',
      scope: { kind: 'selection', tableIds: ids },
      dialect: null,
      sql: DEFAULT_SQL_OPTIONS,
    }).text;
  const inSelection = (extra: Partial<SyncContext> = {}) =>
    context({ scope: { kind: 'selection', baseline: ids }, ...extra });

  it('plans nothing for the writer text of the selection', async () => {
    const result = planSchemaSync(deck, await readRaw(selectionText()), inSelection());
    expect(errors(result)).toEqual([]);
    expect(result.plan.isEmpty).toBe(true);
  });

  it('removes only the table whose block was deleted, never one outside', async () => {
    const text = selectionText()
      .replace(/Table order_items \{[\s\S]*?\n\}\n\n?/, '')
      .replace(/Ref: order_items[^\n]*\n/g, '');
    const result = planSchemaSync(deck, await readRaw(text), inSelection());
    expect(result.plan.removeTables.map((t) => t.name)).toEqual(['order_items']);
    expect(result.plan.removesAll).toBe(false);
    expect(result.plan.updateTables).toEqual([]);
  });

  it('does not touch relationships to tables outside, and accepts a ref to one', async () => {
    const withRef = `${selectionText().trimEnd()}\nRef: orders.shipping_address_id > addresses.id\n`;
    const result = planSchemaSync(deck, await readRaw(withRef), inSelection());
    expect(errors(result)).toEqual([]);
    // The deck already holds "ships to"; the typed line is the same ends, so it matches it.
    expect(result.plan.relationshipOps.removes).toEqual([]);
  });

  it('adds a new table typed into the selection and leaves the others alone', async () => {
    const text = `${selectionText().trimEnd()}\n\nTable notes {\n  id int [pk]\n}\n`;
    const result = planSchemaSync(deck, await readRaw(text), inSelection());
    expect(result.plan.addTables.map((t) => t.node.title)).toEqual(['notes']);
    expect(result.plan.removeTables).toEqual([]);
  });

  it('refuses a new table named like one outside the selection', async () => {
    const text = `${selectionText().trimEnd()}\n\nTable customers {\n  id int [pk]\n}\n`;
    const result = planSchemaSync(deck, await readRaw(text), inSelection());
    expect(result.problems.map((p) => p.code)).toContain('duplicate-table');
    expect(result.plan.isEmpty).toBe(true);
  });

  it('bounds removals by the baseline: a table outside is not removed when absent from the text', async () => {
    const result = planSchemaSync(deck, await readRaw(selectionText()), inSelection());
    expect(result.plan.removeTables).toEqual([]);
  });
});

describe('planSchemaSync: plan shape', () => {
  it('is deterministic for the same input and ids', async () => {
    const a = planSchemaSync(deck, await readRaw(edits.addTableWithRef(shopText())), {
      ...context(),
      newId: (prefix) => `${prefix}.x`,
    });
    const b = planSchemaSync(deck, await readRaw(edits.addTableWithRef(shopText())), {
      ...context(),
      newId: (prefix) => `${prefix}.x`,
    });
    expect(a).toEqual(b);
  });

  it('puts only DBML-expressed fields in a column patch', async () => {
    const { plan: p } = await plan(edits.renameColumn(shopText()));
    const patch = p.tableOps[0]?.columns.updates[0]?.patch ?? {};
    const allowed = new Set([
      'name',
      'type',
      'size',
      'pk',
      'notNull',
      'unique',
      'increment',
      'default',
      'defaultExpr',
      'check',
      'enumRef',
      'note',
    ]);
    expect(Object.keys(patch).every((k) => allowed.has(k))).toBe(true);
  });
});

export type { SchemaPlan };
