import { fromJSON, serializeDeck, toJSON } from '@sododeck/model';
import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { flowDeck } from '../../test/flow-fixtures';
import { deckOf } from '../../test/render-canvas';
import { announced, renderFlows } from '../../test/render-flows';

const group = (name: string) => screen.getByRole('group', { name });
const flowTitles = (feature: string) =>
  within(within(group(feature)).getByRole('list', { name: `Flows in ${feature}` }))
    .getAllByRole('listitem')
    .map((li) => within(li).getAllByRole('button')[0]?.textContent);

describe('FlowList: features and flows (US1, US3)', () => {
  it('lists features with their flows and step counts, and "No feature" when needed', () => {
    renderFlows(flowDeck);
    expect(flowTitles('Delivery')).toEqual(['Place order', 'Assign driver']);
    expect(screen.getByRole('button', { name: 'Place order' })).toHaveAccessibleDescription(
      '2 steps',
    );
    expect(flowTitles('No feature')).toEqual(['Refund']);
    expect(within(group('Payments')).getByText('0 flows')).toBeInTheDocument();
  });

  it('hides "No feature" when every flow has a feature', () => {
    renderFlows({ ...flowDeck, flows: flowDeck.flows.slice(0, 2) });
    expect(screen.queryByRole('group', { name: 'No feature' })).not.toBeInTheDocument();
  });

  it('offers "+ New flow" in "No feature" when the deck has no features', () => {
    renderFlows(deckOf({}));
    expect(within(group('No feature')).getByRole('button', { name: 'New flow' })).toBeVisible();
  });

  it('"+ New flow" asks for a name: empty is refused, a name starts recording', async () => {
    const { user, ui } = renderFlows(flowDeck);
    await user.click(within(group('Delivery')).getByRole('button', { name: 'New flow' }));
    const dialog = screen.getByRole('dialog', { name: 'New flow in Delivery' });
    await user.click(within(dialog).getByRole('button', { name: 'Start recording' }));
    expect(within(dialog).getByText('Enter a flow name')).toBeInTheDocument();
    expect(ui().flowSession).toBeNull();
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Checkout{Enter}');
    expect(ui().flowSession).toMatchObject({ pendingTitle: 'Checkout', featureId: 'delivery' });
  });

  it('shows a flow when its row is clicked', async () => {
    const { user, ui } = renderFlows(flowDeck);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(ui().activeFlow?.flowId).toBe('place');
    expect(screen.getByRole('list', { name: 'Steps' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to canvas' }));
    expect(ui().activeFlow).toBeNull();
  });

  it('adds a feature and renames it inline; an empty name keeps the old one', async () => {
    const { user, doc } = renderFlows(flowDeck);
    await user.click(screen.getByRole('button', { name: 'New feature' }));
    const field = screen.getByRole('textbox', { name: 'Feature name' });
    await user.clear(field);
    await user.type(field, 'Tracking{Enter}');
    expect(toJSON(doc).features.map((f) => f.title)).toEqual(['Delivery', 'Payments', 'Tracking']);

    const heading = within(group('Tracking')).getByRole('heading', { name: 'Tracking' });
    act(() => {
      heading.focus();
    });
    await user.keyboard('{F2}');
    await user.clear(screen.getByRole('textbox', { name: 'Feature name' }));
    await user.keyboard('{Enter}');
    expect(toJSON(doc).features.at(-1)?.title).toBe('Tracking');
  });

  it('renames a flow with F2 and from its menu', async () => {
    const { user, doc } = renderFlows(flowDeck);
    act(() => {
      screen.getByRole('button', { name: 'Refund' }).focus();
    });
    await user.keyboard('{F2}');
    const field = screen.getByRole('textbox', { name: 'Flow name' });
    await user.clear(field);
    await user.type(field, 'Refund order{Enter}');
    expect(toJSON(doc).flows[2]?.title).toBe('Refund order');

    await user.click(screen.getByRole('button', { name: 'Flow actions: Refund order' }));
    await user.click(await screen.findByRole('menuitem', { name: /Rename/ }));
    await user.clear(screen.getByRole('textbox', { name: 'Flow name' }));
    await user.type(screen.getByRole('textbox', { name: 'Flow name' }), 'Refunds{Enter}');
    expect(toJSON(doc).flows[2]?.title).toBe('Refunds');
  });

  it('moves a flow to another feature from its menu, last in that feature', async () => {
    const { user, doc } = renderFlows({
      ...flowDeck,
      flows: [...flowDeck.flows, { id: 'p2', title: 'Pay', feature: 'payments', steps: [] }],
    });
    await user.click(screen.getByRole('button', { name: 'Flow actions: Place order' }));
    await user.hover(await screen.findByRole('menuitem', { name: /Move to feature/ }));
    await user.keyboard('{ArrowRight}');
    // Keyboard only: Delivery (checked), Payments, No feature.
    await waitFor(() => {
      expect(screen.getByRole('menuitemradio', { name: 'Delivery' })).toHaveFocus();
    });
    await user.keyboard('{ArrowDown}{Enter}');
    expect(toJSON(doc).flows.find((f) => f.id === 'place')?.feature).toBe('payments');
    expect(toJSON(doc).flows.map((f) => f.id)).toEqual(['assign', 'loose', 'p2', 'place']);
  });

  it('deletes a feature after confirming; its flows move to "No feature"; undo restores', async () => {
    const { user, doc, editor } = renderFlows(flowDeck);
    await user.click(screen.getByRole('button', { name: 'Feature actions: Delivery' }));
    await user.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete ‘Delivery’?' });
    expect(dialog).toHaveTextContent('Its 2 flows will move to No feature.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(flowTitles('No feature')).toEqual(['Place order', 'Assign driver', 'Refund']);
    expect((await screen.findAllByText(/Deleted ‘Delivery’/)).length).toBeGreaterThan(0);
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(flowDeck);
  });

  it('deletes a flow after confirming, with the step count', async () => {
    const { user, doc } = renderFlows(flowDeck);
    await user.click(screen.getByRole('button', { name: 'Flow actions: Place order' }));
    await user.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete ‘Place order’?' });
    expect(dialog).toHaveTextContent('Its 2 steps will be deleted.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(toJSON(doc).flows.map((f) => f.id)).toEqual(['assign', 'loose']);
  });

  it('reorders flows with ⌥↑, and the order survives export → import', async () => {
    const { user, doc } = renderFlows(flowDeck);
    act(() => {
      screen.getByRole('button', { name: 'Assign driver' }).focus();
    });
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(flowTitles('Delivery')).toEqual(['Assign driver', 'Place order']);
    expect(announced()).toBe('Moved to position 1 of 2');
    const reloaded = toJSON(fromJSON(JSON.parse(serializeDeck(toJSON(doc)))));
    expect(reloaded.flows.map((f) => f.id)).toEqual(['assign', 'place', 'loose']);
  });

  it('reorders features with ⌥↓', async () => {
    const { user, doc } = renderFlows(flowDeck);
    act(() => {
      within(group('Delivery')).getByRole('heading', { name: 'Delivery' }).focus();
    });
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(toJSON(doc).features.map((f) => f.id)).toEqual(['payments', 'delivery']);
  });

  it('marks a flow with a broken step as "Has problems"; undo clears it', () => {
    const { editor } = renderFlows(flowDeck);
    const row = () => screen.getByRole('button', { name: 'Place order' }).closest('li');
    expect(row()).not.toHaveTextContent('Has problems');
    act(() => {
      editor().remove('edges', 'bc');
    });
    expect(row()).toHaveTextContent('Has problems');
    act(() => {
      editor().undo();
    });
    expect(row()).not.toHaveTextContent('Has problems');
  });
});

describe('flow filter (US5)', () => {
  it('/ focuses the filter; it filters by name, step text and condition, with "n of m"', async () => {
    const { user } = renderFlows(flowDeck);
    act(() => {
      document.body.focus();
    });
    await user.keyboard('/');
    const filter = screen.getByRole('searchbox', { name: 'Filter flows' });
    expect(filter).toHaveFocus();
    await user.keyboard('order');
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign driver' })).not.toBeInTheDocument();
    // The match is bold and underlined, and the parent feature stays.
    expect(screen.getByText('order', { selector: 'mark' })).toBeInTheDocument();
    expect(group('Delivery')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Payments' })).not.toBeInTheDocument();

    await user.clear(filter);
    await user.type(filter, 'token');
    expect(screen.getByRole('button', { name: 'Place order' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(filter).toHaveValue('');
  });

  it('shows an empty state with Clear filter and New flow', async () => {
    const { user, ui } = renderFlows(flowDeck);
    await user.type(screen.getByRole('searchbox', { name: 'Filter flows' }), 'zzz');
    expect(screen.getByText('No flows match “zzz”')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(ui().flowFilter).toBe('');
    await user.type(screen.getByRole('searchbox', { name: 'Filter flows' }), 'zzz');
    await user.click(screen.getByRole('button', { name: 'New flow ‘zzz’' }));
    expect(ui().flowSession).toMatchObject({ pendingTitle: 'zzz', featureId: 'delivery' });
  });

  it('is hidden during a session', () => {
    const { ui } = renderFlows(flowDeck);
    act(() => {
      ui().startRecording('X', null);
    });
    expect(screen.queryByRole('searchbox', { name: 'Filter flows' })).not.toBeInTheDocument();
  });
});
