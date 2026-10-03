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

describe('EdgeInspector Line section (029 T043)', () => {
  const lineGroup = () => screen.getByRole('radiogroup', { name: 'Type' });

  it('shows the effective line type and sets it in one undo step', async () => {
    const { user, doc, editor, ui } = setup();
    expect(within(lineGroup()).getByRole('radio', { name: 'Curved' })).toBeChecked();
    await user.click(within(lineGroup()).getByRole('radio', { name: 'Elbow' }));
    expect(edge(doc)?.style).toEqual({ shape: 'elbow' });
    expect(within(lineGroup()).getByRole('radio', { name: 'Elbow' })).toBeChecked();
    expect(ui().lastLineShape).toBe('elbow');
    act(() => {
      editor().undo();
    });
    expect(edge(doc)?.style).toBeUndefined();
  });

  it('shows Route fields only for an elbow line', async () => {
    const { user } = setup();
    expect(screen.queryByRole('combobox', { name: 'From side' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset route' })).toBeNull();
    await user.click(within(lineGroup()).getByRole('radio', { name: 'Elbow' }));
    expect(screen.getByRole('combobox', { name: 'From side' })).toBeInTheDocument();
    await user.click(within(lineGroup()).getByRole('radio', { name: 'Straight' }));
    expect(screen.queryByRole('combobox', { name: 'From side' })).toBeNull();
  });

  it('reads a pre-029 offset as elbow', () => {
    renderInspector(
      {
        ...inspectorDeck,
        edges: inspectorDeck.edges.map((e) => (e.id === 'op' ? { ...e, route: { offset: 8 } } : e)),
      },
      { edges: ['op'] },
    );
    expect(within(lineGroup()).getByRole('radio', { name: 'Elbow' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'From side' })).toBeInTheDocument();
  });
});

const elbowDeck = {
  ...inspectorDeck,
  edges: inspectorDeck.edges.map((e) =>
    e.id === 'op' ? { ...e, style: { shape: 'elbow' as const } } : e,
  ),
};

describe('EdgeInspector Route fields (017 T050)', () => {
  const setup = () => renderInspector(elbowDeck, { edges: ['op'] });

  it('pins From/To side by picking, each one undo step; "Auto" clears', async () => {
    const { user, doc, editor } = setup();
    const fromSide = screen.getByRole('combobox', { name: 'From side' });
    await user.clear(fromSide);
    await user.type(fromSide, 'Top');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(edge(doc)?.route).toEqual({ fromSide: 'top' });

    const toSide = screen.getByRole('combobox', { name: 'To side' });
    await user.clear(toSide);
    await user.type(toSide, 'Bottom');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(edge(doc)?.route).toEqual({ fromSide: 'top', toSide: 'bottom' });

    await user.clear(fromSide);
    await user.type(fromSide, 'Auto');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(edge(doc)?.route).toEqual({ toSide: 'bottom' });

    act(() => {
      editor().undo();
    });
    expect(edge(doc)?.route).toEqual({ fromSide: 'top', toSide: 'bottom' });
    act(() => {
      editor().undo();
    });
    expect(edge(doc)?.route).toEqual({ fromSide: 'top' });
  });

  it('commits the offset on Enter, as one undo step', async () => {
    const { user, doc, editor } = setup();
    const offset = screen.getByRole('spinbutton', { name: 'Offset' });
    expect(offset).not.toBeDisabled();
    await user.clear(offset);
    await user.type(offset, '24{Enter}');
    expect(edge(doc)?.route).toEqual({ offset: 24 });
    act(() => {
      editor().undo();
    });
    expect(edge(doc)?.route).toBeUndefined();
  });

  it('disables the offset with a hint when the sides share no movable segment', () => {
    const routedDeck = {
      ...elbowDeck,
      edges: elbowDeck.edges.map((e) =>
        e.id === 'op' ? { ...e, route: { fromSide: 'top' as const, toSide: 'left' as const } } : e,
      ),
    };
    renderInspector(routedDeck, { edges: ['op'] });
    const offset = screen.getByRole('spinbutton', { name: 'Offset' });
    expect(offset).toBeDisabled();
    expect(screen.getByText('No middle segment for these sides')).toBeInTheDocument();
  });

  it('resets the route in one step, disabled without one, and announces', async () => {
    const routedDeck = {
      ...elbowDeck,
      edges: elbowDeck.edges.map((e) =>
        e.id === 'op'
          ? { ...e, route: { fromSide: 'right' as const, toSide: 'left' as const, offset: 12 } }
          : e,
      ),
    };
    const { user, doc, ui } = renderInspector(routedDeck, { edges: ['op'] });
    const reset = screen.getByRole('button', { name: 'Reset route' });
    expect(reset).not.toBeDisabled();
    await user.click(reset);
    expect(edge(doc)?.route).toBeUndefined();
    expect(ui().announcement.text).toBe('Route reset');
    expect(screen.getByRole('button', { name: 'Reset route' })).toBeDisabled();
  });
});
