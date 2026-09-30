import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { inspectorDeck } from '../../test/inspector-fixtures';
import { renderInspector } from '../../test/render-inspector';

const setup = (edgeId = 'op') => renderInspector(inspectorDeck, { edges: [edgeId] });
const edge = (doc: Parameters<typeof toJSON>[0]) => toJSON(doc).edges[0];

describe('EdgeInspector (story 1, FR-009)', () => {
  it('edits title, protocol, direction, description, owner, tags and links', async () => {
    const { user, doc, editor } = setup();
    expect(
      screen.getByRole('heading', { name: 'Order Service → Pricing Service' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Connection · op')).toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'POST /quote{Enter}');
    const protocol = screen.getByRole('radiogroup', { name: 'Protocol' });
    expect(within(protocol).getByRole('radio', { name: 'HTTP' })).toBeChecked();
    await user.click(within(protocol).getByRole('radio', { name: 'gRPC' }));
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Direction' })).getByRole('radio', {
        name: 'Both',
      }),
    );
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Asks for a `quote`.');
    await user.type(screen.getByRole('combobox', { name: 'Owner' }), 'Orders{Enter}');
    await user.type(screen.getByRole('combobox', { name: 'Add tag' }), 'sync{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Add link' }), '/specs/quote{Enter}');
    expect(edge(doc)).toMatchObject({
      id: 'op',
      label: 'POST /quote',
      protocol: 'grpc',
      direction: 'both',
      description: 'Asks for a `quote`.',
      owner: 'Orders',
      tags: ['sync'],
      links: [{ url: '/specs/quote', label: 'quote' }],
    });
    await user.click(within(protocol).getByRole('radio', { name: 'Not set' }));
    expect(edge(doc)?.protocol).toBeUndefined();
    act(() => {
      editor().undo();
    });
    expect(edge(doc)?.protocol).toBe('grpc');
  });

  it('reattaches From/To keeping the id, and refuses self and duplicate connections', async () => {
    const { user, doc, ui } = setup();
    const to = screen.getByRole('combobox', { name: 'To' });
    await user.clear(to);
    await user.type(to, 'Order');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent("Can't connect to itself");
    expect(ui().announcement.text).toBe("Can't connect to itself");
    expect(edge(doc)?.to).toBe('p');

    const from = screen.getByRole('combobox', { name: 'From' });
    await user.clear(from);
    await user.type(from, 'Payment');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Already connected');
    expect(edge(doc)?.from).toBe('o');

    await user.clear(to);
    await user.type(to, 'Payment');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(edge(doc)).toMatchObject({ id: 'op', from: 'o', to: 'y', label: 'quote' });
    expect(
      screen.getByRole('heading', { name: 'Order Service → Payment Service' }),
    ).toBeInTheDocument();
  });

  it('clears the moved end side and the offset when reattach changes a card (017 R12)', async () => {
    const routedDeck = {
      ...inspectorDeck,
      edges: inspectorDeck.edges.map((e) =>
        e.id === 'op'
          ? { ...e, route: { fromSide: 'right' as const, toSide: 'left' as const, offset: 12 } }
          : e,
      ),
    };
    const { user, doc } = renderInspector(routedDeck, { edges: ['op'] });
    expect(edge(doc)?.route).toEqual({ fromSide: 'right', toSide: 'left', offset: 12 });

    const to = screen.getByRole('combobox', { name: 'To' });
    await user.clear(to);
    await user.type(to, 'Payment');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(edge(doc)?.to).toBe('y');
    expect(edge(doc)?.route).toEqual({ fromSide: 'right' });
  });

  it('lists the flow steps that use it and opens one', async () => {
    const { user, ui } = setup();
    const uses = screen.getByRole('list', { name: 'Used in flows' });
    expect(
      within(uses)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Place order · Step 1', 'Assign driver · Step 2']);
    await user.click(within(uses).getByRole('button', { name: 'Assign driver · Step 2' }));
    expect(ui().activeFlow).toMatchObject({ flowId: 'assign', stepId: 't2', branchId: null });
  });

  it('says when no flow uses it, and deletes through the dialog', async () => {
    const view = renderInspector({ ...inspectorDeck, flows: [] }, { edges: ['py'] });
    expect(screen.getByText('Not used in any flow')).toBeInTheDocument();
    await view.user.click(screen.getByRole('button', { name: 'Delete connection' }));
    expect(view.ui().pendingDelete).toEqual({ targets: [{ scope: 'edges', id: 'py' }] });
  });
});
