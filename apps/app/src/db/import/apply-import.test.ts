import { createDeck, createEditor, fromJSON, toJSON } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { CORPUS } from '../fixtures/import/corpus';
import { applyImport, importAsNewDeck, ImportApplyError } from './apply-import';
import { createParsers } from './load-parsers';
import { runImport } from './pipeline';
import type { Placement } from './place-import';
import type { ImportPlan, ImportTarget } from './types';

const TARGET: ImportTarget = {
  kind: 'deck',
  deckDialect: 'generic',
  deckHasTables: false,
  deckHasDescription: false,
  tableNames: [],
  enumNames: [],
};
const NOWHERE: Placement = { positions: {}, frames: {}, stickies: [] };

async function planOf(file: keyof typeof CORPUS): Promise<ImportPlan> {
  const { plan } = await runImport(
    { text: CORPUS[file], format: 'auto', dialect: 'auto', detectFk: false },
    TARGET,
    createParsers(),
  );
  return plan;
}

function deckWith(nodes: ReturnType<typeof emptySododeckFile>['nodes'] = []) {
  const doc = fromJSON({ ...emptySododeckFile(), name: 'Deck', nodes });
  return { doc, editor: createEditor(doc) };
}

describe('applyImport (research R6, FR-021)', () => {
  it('writes the plan by name, sets the dialect and resolves enum references', async () => {
    const plan = await planOf('pg-30-tables.sql');
    const { doc, editor } = deckWith();
    const applied = applyImport(editor, plan, NOWHERE);
    const file = toJSON(doc);
    expect(file.dialect).toBe('postgres');
    expect(file.nodes.map((n) => n.title)).toEqual(plan.fragment.deck.nodes.map((n) => n.title));
    expect(file.edges).toHaveLength(35);
    const status = file.nodes
      .find((n) => n.title === 'orders')
      ?.columns?.find((c) => c.name === 'status');
    expect(file.enums?.find((e) => e.id === status?.enumRef)?.name).toBe('order_status');
    // New ids for everything; the plan's ids are not reused.
    expect(file.nodes.some((n) => n.id.startsWith('node.'))).toBe(false);
    expect(applied.idMap.get('node.1')).toBe(file.nodes[0]?.id);
    expect(applied.idMap.get('dbcol.1')).toBe(file.nodes[0]?.columns?.[0]?.id);
  });

  it('is one undo step that restores the deck exactly (SC-009)', async () => {
    const plan = await planOf('extras.dbml');
    const { doc, editor } = deckWith();
    const before = toJSON(doc);
    applyImport(editor, plan, { positions: {}, frames: {}, stickies: [{ x: 0, y: 900 }] });
    expect(toJSON(doc).nodes).toHaveLength(5);
    expect(toJSON(doc).stickies).toHaveLength(1);
    expect(toJSON(doc).description).toBe('Customer relationship schema');
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('renames a table the deck already has once, with the copy rule paste also uses (043)', async () => {
    const plan = await runImport(
      {
        text: 'CREATE TABLE orders (id int);',
        format: 'sql',
        dialect: 'postgres',
        detectFk: false,
      },
      { ...TARGET, deckHasTables: true, tableNames: [{ name: 'orders' }] },
      createParsers(),
    ).then((r) => r.plan);
    const { doc, editor } = deckWith([
      { id: 'old', type: 'db-table', title: 'orders', columns: [] },
    ]);
    applyImport(editor, plan, NOWHERE);
    expect(toJSON(doc).nodes.map((n) => n.title)).toEqual(['orders', 'orders_copy']);
    expect(plan.report.changed.map((c) => c.detail)).toEqual([
      'a table named orders already exists, imported as orders_copy',
    ]);
  });

  it('puts the tables inside a database card', async () => {
    const plan = await planOf('mysql-dump.sql');
    const { doc, editor } = deckWith([{ id: 'card.db', type: 'database', title: 'Orders DB' }]);
    applyImport(editor, plan, NOWHERE, { cardId: 'card.db' });
    const tables = toJSON(doc).nodes.filter((n) => n.type === 'db-table');
    expect(tables).toHaveLength(3);
    expect(tables.every((t) => t.parent === 'card.db')).toBe(true);
  });

  it('writes nothing when the fragment or the card is invalid', async () => {
    const plan = await planOf('mysql-dump.sql');
    const { doc, editor } = deckWith();
    const before = toJSON(doc);
    expect(() => applyImport(editor, plan, NOWHERE, { cardId: 'gone' })).toThrow(ImportApplyError);
    const broken: ImportPlan = {
      ...plan,
      fragment: {
        ...plan.fragment,
        deck: { ...plan.fragment.deck, nodes: [{ id: 'bad id!', type: 'db-table', title: '' }] },
      },
    };
    expect(() => applyImport(editor, broken, NOWHERE)).toThrow(ImportApplyError);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('builds a new deck file with the import and its dialect, leaving the open deck alone (FR-022)', async () => {
    const plan = await planOf('sqlite.sql');
    const open = createDeck();
    const before = toJSON(open);
    const file = importAsNewDeck(plan, NOWHERE, 'sqlite');
    expect(file).toMatchObject({ name: 'sqlite', dialect: 'sqlite' });
    expect(file.nodes).toHaveLength(3);
    expect(file.packs).toContain('database');
    expect(() => fromJSON(file)).not.toThrow();
    expect(toJSON(open)).toEqual(before);
  });
});
