import { toJSON, type DeckDoc } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { tableCounts } from '../../db/owner';
import { useUiStore, type MenuTarget } from '../../state/ui-store';
import { actionContext, sel } from '../../test/action-fixtures';
import { LOCKED_HINT } from '../lock';
import { actionsFor, runAction } from './actions-for';
import { EMPTY_DATABASE_HINT, moveTableTo, NO_DATABASE_HINT } from './db-actions';
import { ACTIONS } from './index';

const table = (id: string, parent: string | undefined, x: number, y: number) => ({
  id,
  type: 'db-table' as const,
  title: id,
  position: { x, y },
  columns: [{ id: `${id}-id`, name: 'id', type: 'int' }],
  ...(parent === undefined ? {} : { parent }),
});

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'odb', type: 'database', title: 'Orders DB', position: { x: 0, y: 0 } },
    { id: 'cdb', type: 'database', title: 'Customers DB', position: { x: 400, y: 0 } },
    { id: 'empty', type: 'database', title: 'Empty DB', position: { x: 800, y: 0 } },
    table('orders', 'odb', 0, 0),
    table('items', 'odb', 300, 0),
    table('customers', 'cdb', 0, 0),
    { ...table('payments', 'odb', 600, 0), locked: true as const },
    table('loose', undefined, 0, 400),
  ],
  edges: [
    {
      id: 'fk',
      from: 'orders',
      to: 'customers',
      fromColumns: ['orders-id'],
      toColumns: ['customers-id'],
    },
  ],
};

const one = (id: string): MenuTarget => ({ kind: 'component', ids: sel({ nodes: [id] }) });
const menu = (id: string, file: SododeckFile | DeckDoc = deck) =>
  actionsFor(ACTIONS, actionContext(one(id), 'edit', file), 'menu').flatMap((s) => s.actions);
const item = (id: string, actionId: string, file?: SododeckFile | DeckDoc) =>
  menu(id, file).find((a) => a.id === actionId);
const node = (doc: DeckDoc, id: string) => toJSON(doc).nodes.find((n) => n.id === id);

beforeEach(() => {
  useUiStore.getState().resetForDeck();
});

describe('Move to database… (049 US1)', () => {
  it('lists the other database cards and moves the table, counts following', () => {
    const action = item('orders', 'table.moveToDatabase');
    expect(action?.label).toBe('Move to database…');
    expect(action?.disabled).toBeNull();
    expect(action?.children?.map((c) => c.label)).toEqual(['Customers DB', 'Empty DB']);

    const ctx = actionContext(one('orders'), 'edit', deck);
    moveTableTo(ctx.editor, ctx.deck, 'orders', 'cdb');
    const after = toJSON(ctx.doc);
    expect(node(ctx.doc, 'orders')?.parent).toBe('cdb');
    expect(tableCounts(after).get('odb')).toBe(2);
    expect(tableCounts(after).get('cdb')).toBe(2);
    expect(after.edges).toEqual(deck.edges);
    expect(node(ctx.doc, 'orders')?.columns).toEqual(deck.nodes[3]?.columns);
    expect(useUiStore.getState().announcement.text).toBe('Moved orders to Customers DB');
  });

  it('is one undo step, placement included', () => {
    const ctx = actionContext(one('orders'), 'edit', deck);
    moveTableTo(ctx.editor, ctx.deck, 'orders', 'cdb');
    // `customers` sits at (0, 0) inside Customers DB, so `orders` moved to a free spot.
    expect(node(ctx.doc, 'orders')?.position).not.toEqual({ x: 0, y: 0 });
    ctx.editor.undo();
    expect(toJSON(ctx.doc)).toEqual(ctx.deck);
  });

  it('is disabled with a reason on a locked table or a deck with no database card', () => {
    expect(item('payments', 'table.moveToDatabase')?.disabled).toBe(LOCKED_HINT);
    const noCards = { ...deck, nodes: deck.nodes.filter((n) => n.type === 'db-table') };
    expect(item('loose', 'table.moveToDatabase', noCards)?.disabled).toBe(NO_DATABASE_HINT);
  });

  it('is offered only for one table', () => {
    expect(item('odb', 'table.moveToDatabase')).toBeUndefined();
  });
});

describe('Remove from card (049 US1)', () => {
  it('is shown only for a table with an owner', () => {
    expect(item('orders', 'table.removeFromCard')?.label).toBe('Remove from card');
    expect(item('loose', 'table.removeFromCard')).toBeUndefined();
    expect(item('payments', 'table.removeFromCard')?.disabled).toBe(LOCKED_HINT);
  });

  it('clears the owner and places the table free on the level above, one undo step', () => {
    const ctx = actionContext(one('orders'), 'edit', deck);
    expect(runAction(ACTIONS, 'table.removeFromCard', ctx)).toBe(true);
    expect(node(ctx.doc, 'orders')?.parent).toBeUndefined();
    ctx.editor.undo();
    expect(node(ctx.doc, 'orders')?.parent).toBe('odb');
    expect(toJSON(ctx.doc)).toEqual(ctx.deck);
  });
});

describe('Export this database as SQL (049 US4)', () => {
  it('opens the export dialog on the card’s database scope', () => {
    const ctx = actionContext(one('odb'), 'edit', deck);
    expect(runAction(ACTIONS, 'database.exportSql', ctx)).toBe(true);
    const ui = useUiStore.getState();
    expect(ui.selection.nodes).toEqual(['odb']);
    expect(ui.exportDialog).toMatchObject({
      open: true,
      seed: { format: 'sql', scope: 'database' },
    });
  });

  it('is disabled with a reason for an empty database and absent for other cards', () => {
    expect(item('empty', 'database.exportSql')?.disabled).toBe(EMPTY_DATABASE_HINT);
    expect(item('orders', 'database.exportSql')).toBeUndefined();
    expect(item('odb', 'database.exportSql')?.label).toBe('Export this database as SQL');
  });
});
