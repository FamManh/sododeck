import { createEditor, fromJSON, toJSON, type DeckEditor } from '@sododeck/model';
import { parseSododeckFile, type SododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';

import { shopDeck } from '../fixtures/shop';
import { readRaw } from '../fixtures/sync/deck-from-dbml';
import { edits, shopText } from '../fixtures/sync/shop-edits';
import { applySchemaPlan } from './apply-schema-plan';
import { planSchemaSync } from './plan-schema-sync';
import { createSessionMemory, rememberTables } from './session-memory';
import type { SyncContext } from './types';

let counter = 0;
const context = (extra: Partial<SyncContext> = {}): SyncContext => ({
  scope: { kind: 'schema' },
  memory: createSessionMemory(),
  newId: (prefix) => `${prefix}.n${String(counter++)}`,
  viewport: { x: 0, y: 0, width: 1000, height: 600 },
  ...extra,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function open(deck: SododeckFile = shopDeck('postgres'), captureTimeout = 5) {
  const doc = fromJSON(deck);
  const editor = createEditor(doc, { captureTimeout });
  return { doc, editor };
}

async function apply(
  editor: DeckEditor,
  doc: Y.Doc,
  text: string,
  merge = 'k',
  extra: Partial<SyncContext> = {},
) {
  const result = planSchemaSync(toJSON(doc), await readRaw(text), context(extra));
  expect(result.problems.filter((p) => p.severity === 'error')).toEqual([]);
  const applied = applySchemaPlan(editor, result.plan, { merge });
  return { ...result, applied };
}

const tableOf = (file: SododeckFile, name: string) => file.nodes.find((n) => n.title === name);

describe('applySchemaPlan: the deck follows the text and converges', () => {
  const cases: [string, (text: string) => string][] = [
    ['add column', edits.addColumn],
    ['rename table', edits.renameTable],
    ['rename column', edits.renameColumn],
    ['remove table', edits.removeTable],
    ['add table with relationship', edits.addTableWithRef],
    ['rename enum', edits.renameEnum],
    ['replace two tables', edits.replaceTwoTables],
  ];
  for (const [name, edit] of cases) {
    it(`${name}: valid file afterwards and the same text plans nothing`, async () => {
      const { doc, editor } = open();
      const text = edit(shopText());
      await apply(editor, doc, text);
      const after = toJSON(doc);
      const parsed = parseSododeckFile(after);
      expect(parsed.success ? [] : parsed.issues).toEqual([]);
      const again = planSchemaSync(after, await readRaw(text), context());
      expect(again.problems.filter((p) => p.severity === 'error')).toEqual([]);
      expect(again.plan.isEmpty).toBe(true);
    });
  }

  it('keeps ids across a table rename, a column rename and an enum rename', async () => {
    const before = shopDeck('postgres');
    const { doc, editor } = open(before);
    await apply(editor, doc, edits.renameTable(shopText()));
    await apply(editor, doc, edits.renameColumn(edits.renameTable(shopText())));
    await apply(editor, doc, edits.renameEnum(edits.renameColumn(edits.renameTable(shopText()))));
    const after = toJSON(doc);
    expect(tableOf(after, 'clients')?.id).toBe(tableOf(before, 'customers')?.id);
    const orders = tableOf(after, 'orders');
    const wasTotal = tableOf(before, 'orders')?.columns?.find((c) => c.name === 'total');
    expect(orders?.columns?.find((c) => c.name === 'grand_total')?.id).toBe(wasTotal?.id);
    const status = before.enums?.find((e) => e.name === 'order_status');
    expect(after.enums?.find((e) => e.name === 'order_state')?.id).toBe(status?.id);
    // Relationships kept their ids (the rename never touched them).
    expect(after.edges.map((e) => e.id).sort()).toEqual(before.edges.map((e) => e.id).sort());
  });

  it('adds the column in the text order and places a new table right of the rest', async () => {
    const { doc, editor } = open();
    const { applied } = await apply(editor, doc, edits.addTableWithRef(shopText()));
    const after = toJSON(doc);
    const coupons = tableOf(after, 'coupons');
    expect(applied.addedTableIds).toEqual([coupons?.id]);
    const others = after.nodes.filter((n) => n.type === 'db-table' && n.title !== 'coupons');
    expect(coupons?.position?.x ?? 0).toBeGreaterThan(
      Math.max(...others.map((n) => n.position?.x ?? 0)),
    );
    const orders = tableOf(after, 'orders');
    const names = orders?.columns?.map((c) => c.name) ?? [];
    expect(names.indexOf('coupon_id')).toBe(names.indexOf('billing_address_id') + 1);
    expect(names.at(-1)).toBe('created_at');
  });

  it('reports what it removed', async () => {
    const { doc, editor } = open();
    const { applied } = await apply(editor, doc, edits.removeTable(shopText()));
    expect(applied.removedTables.map((t) => t.name)).toEqual(['shipments']);
    expect(tableOf(toJSON(doc), 'shipments')).toBeUndefined();
  });
});

describe('applySchemaPlan: undo and restore', () => {
  it('two applies under one merge key undo in one step, however far apart', async () => {
    const original = shopDeck('postgres');
    const { doc, editor } = open(original);
    const first = edits.addColumn(shopText());
    await apply(editor, doc, first, 'dbml:1:0');
    await sleep(40);
    await apply(editor, doc, edits.renameTable(first), 'dbml:1:0');
    expect(tableOf(toJSON(doc), 'clients')).toBeDefined();
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(original);
    expect(editor.canUndo()).toBe(false);
  });

  it('a new merge key starts a new step', async () => {
    const original = shopDeck('postgres');
    const { doc, editor } = open(original);
    const first = edits.addColumn(shopText());
    await apply(editor, doc, first, 'dbml:1:0');
    await sleep(40);
    await apply(editor, doc, edits.renameTable(first), 'dbml:1:1');
    editor.undo();
    expect(tableOf(toJSON(doc), 'customers')).toBeDefined();
    expect(tableOf(toJSON(doc), 'orders')?.columns?.some((c) => c.name === 'discount_cents')).toBe(
      true,
    );
  });

  it('removes a table, then typing it back restores it at its old position with its ids', async () => {
    const original = shopDeck('postgres');
    const { doc, editor } = open(original);
    const memory = createSessionMemory();
    const gone = tableOf(original, 'shipments');
    if (gone === undefined) throw new Error('no shipments');
    const removal = planSchemaSync(
      toJSON(doc),
      await readRaw(edits.removeTable(shopText())),
      context({ memory }),
    );
    rememberTables(
      memory,
      toJSON(doc),
      removal.plan.removeTables.map((t) => t.id),
    );
    applySchemaPlan(editor, removal.plan, { merge: 'a' });
    expect(tableOf(toJSON(doc), 'shipments')).toBeUndefined();
    await sleep(20);
    await apply(editor, doc, shopText(), 'b', { memory });
    const back = tableOf(toJSON(doc), 'shipments');
    expect(back?.id).toBe(gone.id);
    expect(back?.position).toEqual(gone.position);
    expect(back?.columns?.map((c) => c.id)).toEqual(gone.columns?.map((c) => c.id));
    expect(
      toJSON(doc)
        .edges.map((e) => e.id)
        .sort(),
    ).toEqual(original.edges.map((e) => e.id).sort());
    const check = planSchemaSync(toJSON(doc), await readRaw(shopText()), context());
    expect(check.plan.isEmpty).toBe(true);
  });
});

describe('applySchemaPlan: two editors on one document pair', () => {
  it('an apply in one shows in the other and does not end the other’s burst', async () => {
    const original = shopDeck('postgres');
    const docA = fromJSON(original);
    const docB = new Y.Doc();
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    const editorA = createEditor(docA, { captureTimeout: 5 });
    const editorB = createEditor(docB, { captureTimeout: 5 });
    // Replicate A → B and B → A as another tab would (a remote origin, not tracked by either).
    docA.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') Y.applyUpdate(docB, update, 'remote');
    });
    docB.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') Y.applyUpdate(docA, update, 'remote');
    });
    await apply(editorA, docA, edits.addColumn(shopText()), 'k');
    expect(tableOf(toJSON(docB), 'orders')?.columns?.some((c) => c.name === 'discount_cents')).toBe(
      true,
    );
    await sleep(40);
    // B's own burst continues across A's apply: B's two applies still undo in one step.
    const textB = edits.addColumn(shopText());
    await apply(editorB, docB, edits.renameTable(textB), 'bk');
    await sleep(40);
    await apply(editorA, docA, edits.renameColumn(edits.renameTable(textB)), 'k');
    await sleep(40);
    await apply(
      editorB,
      docB,
      edits.renameColumn(edits.renameTable(textB)).replace('grand_total', 'sum_total'),
      'bk',
    );
    editorB.undo();
    const after = toJSON(docB);
    // B's two applies were one step; A's rename of the column is not B's to undo.
    expect(tableOf(after, 'customers')).toBeDefined();
    expect(tableOf(after, 'clients')).toBeUndefined();
    const orders = tableOf(after, 'orders');
    expect(orders?.columns?.some((c) => c.name === 'grand_total')).toBe(true);
    expect(editorB.canUndo()).toBe(false);
  });
});
