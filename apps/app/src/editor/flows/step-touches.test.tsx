import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { StepTouches } from './step-touches';
import { touchOptions } from './touch-options';

const table = (id: string, parent: string | undefined, columns: string[]) => ({
  id,
  type: 'db-table' as const,
  title: id,
  columns: columns.map((name) => ({ id: `${id}-${name}`, name, type: 'text' })),
  ...(parent === undefined ? {} : { parent }),
});

const deck = deckOf({
  nodes: [
    { id: 'web', type: 'client', title: 'Web' },
    { id: 'svc', type: 'service', title: 'Orders' },
    { id: 'odb', type: 'database', title: 'Orders DB' },
    { id: 'cdb', type: 'database', title: 'Customers DB' },
    table('orders', 'odb', ['id', 'total']),
    table('order_items', 'odb', ['id']),
    table('customers', 'cdb', ['id', 'email']),
    table('audit', undefined, ['id']),
  ],
  edges: [{ id: 'e', from: 'web', to: 'svc' }],
  flows: [{ id: 'fl', title: 'Checkout', steps: [{ id: 's', edge: 'e' }] }],
});

function Harness() {
  const editor = useEditor();
  const snapshot = useDeckSnapshot(editor.doc);
  const step = snapshot.flows[0]?.steps[0];
  return step === undefined ? null : <StepTouches deck={snapshot} flowId="fl" step={step} />;
}

function setup() {
  const view = renderWithEditor(<Harness />, deck);
  const touches = () => toJSON(view.doc).flows[0]?.steps[0]?.touches;
  return { ...view, touches, user: userEvent.setup() };
}

async function addVia(user: ReturnType<typeof userEvent.setup>, query: string) {
  await user.click(screen.getByRole('button', { name: 'Add table or column…' }));
  await user.type(screen.getByRole('searchbox', { name: 'Find a table or table.column' }), query);
  await user.keyboard('{Enter}');
}

describe('StepTouches (049 US3)', () => {
  it('starts empty', () => {
    setup();
    expect(screen.getByText('This step touches no tables.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Touches' })).toBeInTheDocument();
  });

  it('adds a table and a column by keyboard, each with its owner card as context', async () => {
    const { user, touches } = setup();
    await addVia(user, 'orders');
    await addVia(user, 'customers.em');
    expect(touches()).toEqual([
      { table: 'orders', access: 'read' },
      { table: 'customers', column: 'customers-email', access: 'read' },
    ]);
    const list = screen.getByRole('list', { name: 'Tables this step touches' });
    expect(within(list).getByText('customers · email')).toBeInTheDocument();
    expect(within(list).getByText('Customers DB')).toBeInTheDocument();
  });

  it('flips access with the toggle, named "Access for <row>: <access>"', async () => {
    const { user, touches } = setup();
    await addVia(user, 'orders');
    await user.click(screen.getByRole('button', { name: 'Access for orders: read' }));
    expect(touches()).toEqual([{ table: 'orders', access: 'write' }]);
    expect(screen.getByRole('button', { name: 'Access for orders: write' })).toHaveTextContent(
      'Write',
    );
  });

  it('removes a row with its button or with Delete on its toggle', async () => {
    const { user, touches } = setup();
    await addVia(user, 'orders');
    await addVia(user, 'audit');
    await user.click(screen.getByRole('button', { name: 'Remove orders' }));
    expect(touches()).toEqual([{ table: 'audit', access: 'read' }]);
    screen.getByRole('button', { name: 'Access for audit: read' }).focus();
    await user.keyboard('{Delete}');
    expect(touches()).toBeUndefined();
    expect(screen.getByText('This step touches no tables.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add table or column…' })).toHaveFocus();
  });

  it('does not add a pair twice; it focuses the existing row', async () => {
    const { user, touches } = setup();
    await addVia(user, 'orders');
    await addVia(user, 'orders');
    expect(touches()).toEqual([{ table: 'orders', access: 'read' }]);
    expect(screen.getByRole('button', { name: 'Access for orders: read' })).toHaveFocus();
  });

  it('is one undo step per change', async () => {
    const { user, touches, editor } = setup();
    await addVia(user, 'orders');
    await user.click(screen.getByRole('button', { name: 'Access for orders: read' }));
    act(() => {
      editor().undo();
    });
    expect(touches()).toEqual([{ table: 'orders', access: 'read' }]);
    act(() => {
      editor().undo();
    });
    expect(touches()).toBeUndefined();
  });
});

describe('touchOptions (049)', () => {
  it('lists tables by name and, when typing, columns by table.column', () => {
    expect(touchOptions(deck, '').map((o) => o.label)).toEqual([
      'orders',
      'order_items',
      'customers',
      'audit',
    ]);
    expect(touchOptions(deck, 'order').map((o) => o.label)).toEqual(['orders', 'order_items']);
    expect(touchOptions(deck, 'orders.t').map((o) => [o.label, o.context])).toEqual([
      ['orders · total', 'Orders DB'],
    ]);
    expect(touchOptions(deck, 'audit')[0]?.context).toBe('No database');
  });
});
