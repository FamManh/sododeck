import { fromJSON, toJSON, type DeckDoc } from '@sododeck/model';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore, type MenuTarget } from '../../state/ui-store';
import { actionContext, actionDeck, sel } from '../../test/action-fixtures';
import { actionsFor, runAction } from './actions-for';
import { ACTIONS } from './index';

const deck = {
  ...actionDeck,
  nodes: [
    ...actionDeck.nodes,
    {
      id: 't',
      type: 'db-table',
      title: 'orders',
      position: { x: 0, y: 900 },
      columns: [
        { id: 'c1', name: 'id', type: 'int', pk: true as const },
        { id: 'c2', name: 'email', type: 'text' },
        { id: 'c3', name: 'total', type: 'int' },
      ],
    },
    {
      id: 'locked',
      type: 'db-table',
      title: 'payments',
      locked: true as const,
      position: { x: 400, y: 900 },
      columns: [{ id: 'p1', name: 'id', type: 'int' }],
    },
  ],
};

const rowTarget = (columnId: string, tableId = 't'): MenuTarget => ({
  kind: 'row',
  ids: sel({ nodes: [tableId] }),
  row: { tableId, columnId },
});

const ui = () => useUiStore.getState();
const tableOf = (doc: DeckDoc, id = 't') => toJSON(doc).nodes.find((n) => n.id === id);
const columnOf = (doc: DeckDoc, id: string) => tableOf(doc)?.columns?.find((c) => c.id === id);

/** Runs an action on a fresh context over `doc`, as a new menu would. */
function run(doc: DeckDoc | undefined, target: MenuTarget, id: string) {
  const ctx = actionContext(target, 'edit', doc ?? deck);
  expect(runAction(ACTIONS, id, ctx), id).toBe(true);
  return ctx;
}

const menuOf = (target: MenuTarget, doc?: DeckDoc) =>
  actionsFor(ACTIONS, actionContext(target, 'edit', doc ?? deck), 'menu').flatMap((s) => s.actions);

beforeEach(() => {
  ui().resetForDeck();
});

describe('row actions (043 US4, R8)', () => {
  it('"Edit details" opens the drawer on Columns with the row expanded (052 R4)', () => {
    run(undefined, rowTarget('c2'), 'row.details');
    expect(ui().drawer.open).toBe(true);
    expect(ui().selection.nodes).toEqual(['t']);
    expect(ui().tableDrawer).toEqual({
      tab: 'columns',
      expandedColumnId: 'c2',
      focusColumnId: 'c2',
    });
    expect(ui().columnEdit).toBeNull();
  });

  it('keeps "Edit" as the line editor', () => {
    run(undefined, rowTarget('c2'), 'row.edit');
    expect(ui().columnEdit).toMatchObject({ tableId: 't', columnId: 'c2' });
    expect(ui().drawer.open).toBe(false);
  });

  it('"Open details" on a table opens the drawer on General', () => {
    run(undefined, { kind: 'component', ids: sel({ nodes: ['t'] }) }, 'details.open');
    expect(ui().drawer.open).toBe(true);
    expect(ui().tableDrawer.tab).toBe('general');
  });

  it('lists the row menu of frame 149, with checks showing the flags', () => {
    const items = menuOf(rowTarget('c1'));
    expect(items.map((a) => a.label)).toEqual([
      'Edit',
      'Edit details',
      'Set as primary key',
      'Not null',
      'Unique',
      'Add index',
      'Add relationship…',
      'Move up',
      'Move down',
      'Delete column',
    ]);
    expect(items.find((a) => a.id === 'row.pk')?.checked).toBe(true);
    expect(items.find((a) => a.id === 'row.unique')?.checked).toBe(false);
  });

  it('toggles not null, unique and the key, one undo step each, never writing false', () => {
    const ctx = run(undefined, rowTarget('c2'), 'row.notNull');
    expect(columnOf(ctx.doc, 'c2')?.notNull).toBe(true);
    run(ctx.doc, rowTarget('c2'), 'row.notNull');
    expect(columnOf(ctx.doc, 'c2')).not.toHaveProperty('notNull');
    const unique = run(ctx.doc, rowTarget('c2'), 'row.unique');
    expect(columnOf(ctx.doc, 'c2')?.unique).toBe(true);
    unique.editor.undo();
    expect(columnOf(ctx.doc, 'c2')).not.toHaveProperty('unique');
  });

  it('makes a composite key when a second column is set as primary key', () => {
    const ctx = run(undefined, rowTarget('c2'), 'row.pk');
    const keys = tableOf(ctx.doc)
      ?.columns?.filter((c) => c.pk === true)
      .map((c) => c.id);
    expect(keys).toEqual(['c1', 'c2']);
  });

  it('adds a single-column index', () => {
    const ctx = run(undefined, rowTarget('c3'), 'row.addIndex');
    expect(tableOf(ctx.doc)?.indexes?.map((index) => index.columns)).toEqual([['c3']]);
    ctx.editor.undo();
    expect(tableOf(ctx.doc)).not.toHaveProperty('indexes');
  });

  it('moves a column up and down, clamped', () => {
    const ctx = run(undefined, rowTarget('c3'), 'row.moveUp');
    expect(tableOf(ctx.doc)?.columns?.map((c) => c.id)).toEqual(['c1', 'c3', 'c2']);
    run(ctx.doc, rowTarget('c1'), 'row.moveUp');
    expect(tableOf(ctx.doc)?.columns?.map((c) => c.id)).toEqual(['c1', 'c3', 'c2']);
    run(ctx.doc, rowTarget('c1'), 'row.moveDown');
    expect(tableOf(ctx.doc)?.columns?.map((c) => c.id)).toEqual(['c3', 'c1', 'c2']);
  });

  it('starts the column connect from Add relationship…, also on a locked table', () => {
    run(undefined, rowTarget('c2'), 'row.addRelationship');
    expect(ui().popover).toEqual({ kind: 'connect-column', tableId: 't', columnId: 'c2' });
    run(undefined, rowTarget('p1', 'locked'), 'row.addRelationship');
    expect(ui().popover).toEqual({ kind: 'connect-column', tableId: 'locked', columnId: 'p1' });
  });

  it('opens the line editor from Edit', () => {
    run(undefined, rowTarget('c2'), 'row.edit');
    expect(ui().columnEdit).toEqual({ tableId: 't', columnId: 'c2', select: 'name' });
  });

  it('deletes the column in one undo step', () => {
    const ctx = run(undefined, rowTarget('c2'), 'row.delete');
    expect(tableOf(ctx.doc)?.columns?.map((c) => c.id)).toEqual(['c1', 'c3']);
    ctx.editor.undo();
    expect(tableOf(ctx.doc)?.columns?.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('disables the write items of a locked table, with the reason', () => {
    const items = menuOf(rowTarget('p1', 'locked'));
    for (const id of ['row.edit', 'row.pk', 'row.addIndex', 'row.moveUp', 'row.delete']) {
      expect(items.find((a) => a.id === id)?.disabled, id).toBe('Locked · unlock to move or edit');
    }
    expect(items.find((a) => a.id === 'row.addRelationship')?.disabled).toBeNull();
  });
});

describe('table actions (043 US4, US6)', () => {
  const tableTarget: MenuTarget = { kind: 'component', ids: sel({ nodes: ['t'] }) };

  it('opens the new-row editor at the end from Add column', () => {
    run(undefined, tableTarget, 'table.addColumn');
    expect(ui().columnEdit).toEqual({ tableId: 't', columnId: null, at: 3, select: 'name' });
  });

  it('selects the table and opens the SQL export scoped to the selection', () => {
    run(undefined, tableTarget, 'table.exportSql');
    expect(ui().selection.nodes).toEqual(['t']);
    expect(ui().exportDialog).toEqual({
      open: true,
      returnFocus: null,
      seed: { format: 'sql', scope: 'selection' },
    });
  });

  it('offers Add column and Export only on tables', () => {
    const service = menuOf({ kind: 'component', ids: sel({ nodes: ['a'] }) }).map((a) => a.id);
    expect(service).not.toContain('table.addColumn');
    expect(service).not.toContain('table.exportSql');
    expect(service).toContain('node.lock');
  });

  it('locks and unlocks any card, labelled Lock / Unlock', () => {
    const target: MenuTarget = { kind: 'components', ids: sel({ nodes: ['a', 't'] }) };
    expect(menuOf(target).find((a) => a.id === 'node.lock')?.label).toBe('Lock');
    const ctx = run(undefined, target, 'node.lock');
    expect(
      toJSON(ctx.doc)
        .nodes.filter((n) => n.locked === true)
        .map((n) => n.id),
    ).toEqual(['a', 't', 'locked']);
    expect(menuOf(target, ctx.doc).find((a) => a.id === 'node.lock')?.label).toBe('Unlock');
    const unlock = run(ctx.doc, target, 'node.lock');
    expect(tableOf(ctx.doc)).not.toHaveProperty('locked');
    unlock.editor.undo();
    expect(tableOf(ctx.doc)?.locked).toBe(true);
  });

  it('is offered for groups and mixed selections in the menu and the toolbar (054)', () => {
    const targets: MenuTarget[] = [
      { kind: 'group', ids: sel({ groups: ['g'] }) },
      { kind: 'mixed', ids: sel({ nodes: ['a'], edges: ['e'] }) },
      { kind: 'component', ids: sel({ nodes: ['a'] }) },
      { kind: 'components', ids: sel({ nodes: ['a', 'b'] }) },
    ];
    for (const target of targets) {
      for (const surface of ['menu', 'toolbar'] as const) {
        const ctx = actionContext(target, 'edit', deck);
        const ids = actionsFor(ACTIONS, ctx, surface).flatMap((s) => s.actions.map((a) => a.id));
        expect(ids, `${target.kind} ${surface}`).toContain('node.lock');
      }
    }
  });

  it('is not offered when the selection holds no card (a note, a group with nothing in it)', () => {
    const withEmpty = { ...deck, groups: [...deck.groups, { id: 'empty', title: 'Empty' }] };
    for (const ids of [sel({ groups: ['empty'] }), sel({ stickies: ['s'], edges: ['e'] })]) {
      const target: MenuTarget = { kind: 'mixed', ids };
      expect(menuOf(target, fromJSON(withEmpty)).map((a) => a.id)).not.toContain('node.lock');
    }
  });

  it('locks every card of a group, nested groups too, in one undo step (054)', () => {
    const nested = {
      ...deck,
      nodes: deck.nodes.map((n) => (n.id === 'p' ? { ...n, group: 'inner' } : n)),
      groups: [...deck.groups, { id: 'inner', title: 'Inner', parent: 'g' }],
    };
    const target: MenuTarget = { kind: 'group', ids: sel({ groups: ['g'] }) };
    const ctx = run(fromJSON(nested), target, 'node.lock');
    const lockedIds = () =>
      toJSON(ctx.doc)
        .nodes.filter((n) => n.locked === true)
        .map((n) => n.id);
    expect(lockedIds()).toEqual(['a', 'b', 'p', 'locked']);
    expect(ui().announcement.text).toBe('Locked 3 cards');
    expect(menuOf(target, ctx.doc).find((a) => a.id === 'node.lock')?.label).toBe('Unlock');
    ctx.editor.undo();
    expect(lockedIds()).toEqual(['locked']);
    expect(ctx.editor.canUndo()).toBe(false);
  });

  it('select-all locks only the cards and says how many (054)', () => {
    const everything = sel({
      nodes: ['a', 'b', 'p', 'child', 't', 'locked'],
      edges: ['e'],
      groups: ['g'],
      stickies: ['s'],
    });
    const target: MenuTarget = { kind: 'mixed', ids: everything };
    const ctx = run(undefined, target, 'node.lock');
    expect(toJSON(ctx.doc).nodes.every((n) => n.locked === true)).toBe(true);
    expect(toJSON(ctx.doc).edges.every((e) => e.locked !== true)).toBe(true);
    expect(toJSON(ctx.doc).stickies.every((s) => s.locked !== true)).toBe(true);
    expect(ui().announcement.text).toBe('Locked 6 cards');
    run(ctx.doc, target, 'node.lock');
    expect(toJSON(ctx.doc).nodes.some((n) => n.locked === true)).toBe(false);
    expect(ui().announcement.text).toBe('Unlocked 6 cards');
  });

  it('refuses Add column on a locked table', () => {
    const items = menuOf({ kind: 'component', ids: sel({ nodes: ['locked'] }) });
    expect(items.find((a) => a.id === 'table.addColumn')?.disabled).toBe(
      'Locked · unlock to move or edit',
    );
  });
});
