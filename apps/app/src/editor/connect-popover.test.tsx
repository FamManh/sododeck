import { toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useEditor } from '../model/use-editor';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { ConnectPopover } from './connect-popover';

const deck = deckOf({
  nodes: [
    { id: 'svc', type: 'service', title: 'Order Service' },
    { id: 'db', type: 'database', title: 'Orders DB' },
    { id: 'dash', type: 'client', title: 'Data dashboard' },
    { id: 'bus', type: 'queue', title: 'Event Bus' },
  ],
  edges: [{ id: 'e1', from: 'svc', to: 'db' }],
});

function Harness() {
  const editor = useEditor();
  return <ConnectPopover deck={useDeckSnapshot(editor.doc)} />;
}

function setup() {
  const view = renderWithEditor(<Harness />, deck);
  act(() => {
    useUiStore.getState().openConnectPopover('svc');
  });
  return { ...view, user: userEvent.setup() };
}

const options = () => screen.getAllByRole('option');
const active = () => options().find((o) => o.getAttribute('aria-selected') === 'true');

describe('ConnectPopover', () => {
  it('lists the other components, would-be duplicates disabled', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Connect Order Service to…' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Find component' })).toHaveFocus();
    expect(options().map((o) => o.textContent)).toEqual([
      'Data dashboard',
      'Event Bus',
      'Orders DBalready connected',
    ]);
    expect(screen.queryByRole('option', { name: /Order Service/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Orders DB/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('filters by typing and connects with Enter, switching to the edge popover', async () => {
    const { doc, user } = setup();
    await user.keyboard('bus{Enter}');
    expect(toJSON(doc).edges.at(-1)).toMatchObject({ from: 'svc', to: 'bus' });
    const popover = useUiStore.getState().popover;
    expect(popover?.kind).toBe('edge');
  });

  it('skips disabled options with the arrow keys and ignores Enter on them', async () => {
    const { doc, user } = setup();
    expect(active()?.textContent).toBe('Data dashboard');
    await user.keyboard('{ArrowDown}');
    expect(active()?.textContent).toBe('Event Bus');
    await user.keyboard('{ArrowDown}');
    expect(active()?.textContent).toBe('Event Bus');
    await user.clear(screen.getByRole('combobox', { name: 'Find component' }));
    await user.keyboard('orders{Enter}');
    expect(toJSON(doc).edges).toHaveLength(1);
  });

  it('ignores a click on a disabled option', async () => {
    const { doc, user } = setup();
    await user.click(screen.getByRole('option', { name: /Orders DB/ }));
    expect(toJSON(doc).edges).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const { user } = setup();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useUiStore.getState().popover).toBeNull();
  });
});
