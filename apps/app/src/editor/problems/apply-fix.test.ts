import { checkDeck, createEditor, fromJSON, toJSON, type Problem } from '@sododeck/model';
import type { ProblemFix } from '@sododeck/model';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf } from '../../test/render-canvas';
import { LOCKED_HINT } from '../lock';
import { applyFix, fixLockedReason } from './apply-fix';

const initialUi = useUiStore.getState();

const file = () =>
  deckOf({
    dialect: 'postgres',
    enums: [{ id: 'en', name: 'status', values: [] }],
    nodes: [
      {
        id: 'log',
        type: 'db-table',
        title: 'audit_log',
        position: { x: 0, y: 0 },
        columns: [{ id: 'l-id', name: 'id', type: 'integer' }],
      },
      {
        id: 'ord',
        type: 'db-table',
        title: 'orders',
        position: { x: 300, y: 0 },
        columns: [
          { id: 'o-id', name: 'id', type: 'uuid', pk: true, notNull: true },
          { id: 'o-status', name: 'status', type: 'text', notNull: true, defaultExpr: 'NULL' },
        ],
      },
      {
        id: 'pts',
        type: 'db-table',
        title: 'loyalty_points',
        position: { x: 600, y: 0 },
        columns: [
          { id: 'p-id', name: 'id', type: 'integer', pk: true },
          { id: 'p-ref', name: 'customer_ref', type: 'int' },
        ],
      },
      {
        id: 'prod',
        type: 'db-table',
        title: 'products',
        position: { x: 0, y: 300 },
        columns: [{ id: 'pr-id', name: 'id', type: 'uuid', pk: true }],
      },
      {
        id: 'cat',
        type: 'db-table',
        title: 'categories',
        position: { x: 300, y: 300 },
        columns: [{ id: 'ca-id', name: 'id', type: 'uuid', pk: true }],
      },
    ],
    edges: [
      {
        id: 'rel',
        from: 'pts',
        to: 'ord',
        fromColumns: ['p-ref'],
        toColumns: ['o-id'],
        cardinality: 'n-1',
      },
      { id: 'nn', from: 'prod', to: 'cat', cardinality: 'n-n' },
    ],
  });

function setup() {
  useUiStore.setState(initialUi, true);
  const doc = fromJSON(file());
  const editor = createEditor(doc);
  const undoToast = vi.fn();
  const ctx = { editor, undoToast };
  const stub = {} as Problem;
  const node = (id: string) => toJSON(doc).nodes.find((n) => n.id === id);
  const column = (table: string, id: string) => node(table)?.columns?.find((c) => c.id === id);
  return { doc, editor, ctx, stub, node, column };
}

const announced = () => useUiStore.getState().announcement.text;

describe('applyFix (047 R5)', () => {
  beforeEach(() => {
    useUiStore.setState(initialUi, true);
  });

  const writeFix = (
    fix: ProblemFix,
    check: (s: ReturnType<typeof setup>) => void,
    text: string,
  ) => {
    const s = setup();
    const before = toJSON(s.doc);
    expect(applyFix(s.ctx, s.stub, fix)).toBe(true);
    check(s);
    expect(announced()).toBe(text);
    s.editor.undo();
    expect(toJSON(s.doc)).toEqual(before);
    expect(s.editor.canUndo()).toBe(false);
  };

  it('make-pk', () => {
    writeFix(
      { kind: 'make-pk', tableId: 'log', columnId: 'l-id', label: 'Make id the PK' },
      (s) => {
        expect(s.column('log', 'l-id')?.pk).toBe(true);
      },
      'id is now the primary key of audit_log',
    );
  });

  it('add-id-pk uses the dialect id type, as the first column', () => {
    writeFix(
      { kind: 'add-id-pk', tableId: 'prod', type: 'char(36)', label: 'Add id' },
      (s) => {
        const [first] = s.node('prod')?.columns ?? [];
        expect(first).toMatchObject({ name: 'id', type: 'char(36)', pk: true, notNull: true });
      },
      'Added id char(36) as the primary key of products',
    );
  });

  it('match-type changes every referencing column in one step', () => {
    writeFix(
      {
        kind: 'match-type',
        tableId: 'pts',
        changes: [{ columnId: 'p-ref', type: 'uuid' }],
        label: 'Change type',
      },
      (s) => {
        expect(s.column('pts', 'p-ref')?.type).toBe('uuid');
      },
      'customer_ref is now uuid',
    );
  });

  it('match-type with a size sets it, and clears it when there is none', () => {
    const s = setup();
    s.editor.updateColumn('pts', 'p-ref', { size: '10' });
    applyFix(s.ctx, s.stub, {
      kind: 'match-type',
      tableId: 'pts',
      changes: [{ columnId: 'p-ref', type: 'varchar', size: '40' }],
      label: 'Change type',
    });
    expect(s.column('pts', 'p-ref')).toMatchObject({ type: 'varchar', size: '40' });
    applyFix(s.ctx, s.stub, {
      kind: 'match-type',
      tableId: 'pts',
      changes: [{ columnId: 'p-ref', type: 'uuid' }],
      label: 'Change type',
    });
    expect(s.column('pts', 'p-ref')?.size).toBeUndefined();
  });

  it('match-type announces composite changes by count', () => {
    const s = setup();
    s.editor.addColumn('pts', { name: 'other', type: 'int' });
    const other = s.node('pts')?.columns?.[2]?.id ?? '';
    applyFix(s.ctx, s.stub, {
      kind: 'match-type',
      tableId: 'pts',
      changes: [
        { columnId: 'p-ref', type: 'uuid' },
        { columnId: other, type: 'uuid' },
      ],
      label: 'Change type',
    });
    expect(announced()).toBe('2 columns of loyalty_points changed');
  });

  it('remove-default clears the default', () => {
    writeFix(
      { kind: 'remove-default', tableId: 'ord', columnId: 'o-status', label: 'Remove default' },
      (s) => {
        expect(s.column('ord', 'o-status')?.defaultExpr).toBeUndefined();
      },
      'Removed the default of orders.status',
    );
  });

  it('allow-null drops not null', () => {
    writeFix(
      { kind: 'allow-null', tableId: 'ord', columnId: 'o-status', label: 'Allow null' },
      (s) => {
        expect(s.column('ord', 'o-status')?.notNull).toBeUndefined();
      },
      'orders.status now allows null',
    );
  });

  it('delete-edge removes the relationship and shows the Undo toast', () => {
    const s = setup();
    expect(applyFix(s.ctx, s.stub, { kind: 'delete-edge', edgeId: 'rel', label: 'Delete' })).toBe(
      true,
    );
    expect(toJSON(s.doc).edges.some((e) => e.id === 'rel')).toBe(false);
    expect(s.ctx.undoToast).toHaveBeenCalledOnce();
    s.editor.undo();
    expect(toJSON(s.doc).edges.some((e) => e.id === 'rel')).toBe(true);
  });

  it('create-junction adds the table and rewires, in one step', () => {
    const s = setup();
    const before = toJSON(s.doc);
    expect(
      applyFix(s.ctx, s.stub, { kind: 'create-junction', edgeId: 'nn', label: 'Create' }),
    ).toBe(true);
    const after = toJSON(s.doc);
    expect(after.nodes.some((n) => n.title === 'products_categories')).toBe(true);
    expect(after.edges.some((e) => e.id === 'nn')).toBe(false);
    expect(announced()).toBe('Created products_categories');
    expect(useUiStore.getState().selection.nodes).toHaveLength(1);
    s.editor.undo();
    expect(toJSON(s.doc)).toEqual(before);
  });

  it('create-junction does nothing when the relationship is gone', () => {
    const s = setup();
    expect(
      applyFix(s.ctx, s.stub, { kind: 'create-junction', edgeId: 'nope', label: 'Create' }),
    ).toBe(false);
  });

  it('the fixes of a real problem fix it', () => {
    const s = setup();
    const problem = checkDeck(toJSON(s.doc)).list.find((p) => p.kind === 'db-null-default');
    const fix = problem?.fixes?.[0];
    if (problem === undefined || fix === undefined) throw new Error('no fix');
    applyFix(s.ctx, problem, fix);
    expect(checkDeck(toJSON(s.doc)).list.some((p) => p.kind === 'db-null-default')).toBe(false);
  });

  it('rename of a table opens its title edit', () => {
    const s = setup();
    applyFix(s.ctx, s.stub, {
      kind: 'rename',
      target: { type: 'table', tableId: 'ord' },
      label: 'Rename',
    });
    expect(useUiStore.getState().titleEdit).toMatchObject({ target: 'node', id: 'ord' });
    expect(s.editor.canUndo()).toBe(false);
  });

  it('rename of a column opens the table drawer on that column', () => {
    const s = setup();
    applyFix(s.ctx, s.stub, {
      kind: 'rename',
      target: { type: 'column', tableId: 'ord', columnId: 'o-status' },
      label: 'Rename',
    });
    const ui = useUiStore.getState();
    expect(ui.selection.nodes).toEqual(['ord']);
    expect(ui.tableDrawer).toMatchObject({ tab: 'columns', focusColumnId: 'o-status' });
  });

  it('rename of an index opens the Indexes tab', () => {
    const s = setup();
    applyFix(s.ctx, s.stub, {
      kind: 'rename',
      target: { type: 'index', tableId: 'ord', indexId: 'ix' },
      label: 'Rename',
    });
    expect(useUiStore.getState().tableDrawer.tab).toBe('indexes');
  });

  it('rename of an enum opens the enum drawer on its name', () => {
    const s = setup();
    applyFix(s.ctx, s.stub, {
      kind: 'rename',
      target: { type: 'enum', enumId: 'en' },
      label: 'Rename',
    });
    const ui = useUiStore.getState();
    expect(ui.drawer).toMatchObject({ open: true, mode: 'enum', enumId: 'en' });
    expect(ui.enumNameSelect).toBe('en');
  });

  it('pick-column selects the relationship and opens the drawer', () => {
    const s = setup();
    applyFix(s.ctx, s.stub, { kind: 'pick-column', edgeId: 'rel', label: 'Pick column' });
    const ui = useUiStore.getState();
    expect(ui.selection.edges).toEqual(['rel']);
    expect(ui.drawer.open).toBe(true);
  });

  it('add-values opens the enum drawer', () => {
    const s = setup();
    applyFix(s.ctx, s.stub, { kind: 'add-values', enumId: 'en', label: 'Add values' });
    expect(useUiStore.getState().drawer).toMatchObject({ open: true, mode: 'enum', enumId: 'en' });
  });

  it('pick-type opens the table drawer on the column', () => {
    const s = setup();
    applyFix(s.ctx, s.stub, {
      kind: 'pick-type',
      tableId: 'ord',
      columnId: 'o-status',
      label: 'Change type',
    });
    expect(useUiStore.getState().tableDrawer).toMatchObject({
      tab: 'columns',
      focusColumnId: 'o-status',
    });
  });

  it('refuses a fix on a locked table and says why', () => {
    const s = setup();
    s.editor.setLocked(['ord'], true);
    const fix: ProblemFix = {
      kind: 'remove-default',
      tableId: 'ord',
      columnId: 'o-status',
      label: 'Remove default',
    };
    expect(fixLockedReason(toJSON(s.doc), fix)).toBe(LOCKED_HINT);
    expect(applyFix(s.ctx, s.stub, fix)).toBe(false);
    expect(announced()).toBe(LOCKED_HINT);
    expect(s.column('ord', 'o-status')?.defaultExpr).toBe('NULL');
    expect(fixLockedReason(toJSON(s.doc), { ...fix, tableId: 'log' })).toBeNull();
  });
});
