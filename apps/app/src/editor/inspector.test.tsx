import { toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { Inspector } from './inspector';

const deck = deckOf({
  name: 'Shop',
  nodes: [
    { id: 'svc', type: 'service', title: 'Order Service' },
    { id: 'db', type: 'database', title: 'Orders DB' },
  ],
  edges: [{ id: 'e1', from: 'svc', to: 'db', label: 'insert' }],
});

function Harness() {
  return <Inspector deck={useDeckSnapshot(useEditor().doc)} />;
}

function setup(selection: { nodes?: string[]; edges?: string[] } = {}) {
  const view = renderWithEditor(<Harness />, deck);
  act(() => {
    useUiStore.getState().select(selection);
  });
  return { ...view, user: userEvent.setup() };
}

describe('Inspector', () => {
  it('edits the title of one component as a single undo step', async () => {
    const { doc, user, editor } = setup({ nodes: ['svc'] });
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Order Service' })).toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Orders API{Enter}');
    expect(toJSON(doc).nodes[0]?.title).toBe('Orders API');
    expect(screen.getByRole('heading', { name: 'Orders API' })).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).nodes[0]?.title).toBe('Order Service');
    expect(editor().canUndo()).toBe(false);
  });

  it('refuses an empty title and keeps the old one', async () => {
    const { doc, user } = setup({ nodes: ['svc'] });
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.keyboard('{Enter}');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(toJSON(doc).nodes[0]?.title).toBe('Order Service');
    await user.tab();
    expect(title).toHaveValue('Order Service');
  });

  it('reverts a draft with Escape', async () => {
    const { doc, user } = setup({ nodes: ['svc'] });
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.type(title, ' x{Escape}');
    expect(title).toHaveValue('Order Service');
    expect(toJSON(doc).nodes[0]?.title).toBe('Order Service');
  });

  it('edits the label of one connection, clearing it when empty', async () => {
    const { doc, user } = setup({ edges: ['e1'] });
    expect(screen.getByRole('heading', { name: 'Order Service → Orders DB' })).toBeInTheDocument();
    const label = screen.getByRole('textbox', { name: 'Label' });
    await user.clear(label);
    await user.keyboard('{Enter}');
    expect(toJSON(doc).edges[0]?.label).toBeUndefined();
  });

  it('edits the deck name when nothing is selected', async () => {
    const { doc, user } = setup();
    expect(screen.getByRole('heading', { name: 'Shop' })).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Deck name' });
    await user.clear(name);
    await user.type(name, 'Webshop{Enter}');
    expect(toJSON(doc).name).toBe('Webshop');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('shows the count for several items and offers Delete', async () => {
    const { user } = setup({ nodes: ['svc', 'db'], edges: ['e1'] });
    expect(screen.getByRole('heading', { name: '3 items selected' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(useUiStore.getState().pendingDelete).toEqual({ nodes: ['svc', 'db'], edges: ['e1'] });
  });
});
