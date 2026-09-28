import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { useCurrentViewSync } from './use-view-sync';
import { ViewSwitcher } from './view-switcher';

const deck = deckOf({
  nodes: [{ id: 'a', type: 'service', title: 'A' }],
  groups: [{ id: 'g', title: 'G' }],
  views: [
    { id: 'sys', type: 'system', title: 'System' },
    { id: 'mine', type: 'custom', title: 'Mine', excludeGroups: ['g'], pinned: ['a'] },
  ],
});

/** The switcher plus the view sync the canvas mounts. */
function Switcher() {
  useCurrentViewSync();
  return <ViewSwitcher />;
}

const tab = (name: string) => screen.getByRole('tab', { name });

describe('view tab menu (FR-041, FR-042)', () => {
  it('opens by the ⋯ button, a right-click and Shift+F10', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Switcher />, deck);
    await user.click(screen.getByRole('button', { name: 'View options for Mine' }));
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.contextMenu(tab('Mine, custom view'));
    expect(await screen.findByRole('menuitem', { name: 'View settings…' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await new Promise((resolve) => requestAnimationFrame(resolve));
    act(() => {
      tab('System, system view').focus();
    });
    await user.keyboard('{Shift>}{F10}{/Shift}');
    expect(await screen.findByRole('menuitem', { name: /Delete view/ })).toBeInTheDocument();
  });

  it('renames by double-click: Enter commits, Esc cancels, blank is refused', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Switcher />, deck);
    await user.dblClick(tab('Mine, custom view'));
    const field = screen.getByRole('textbox', { name: 'View name' });
    await user.clear(field);
    await user.keyboard('{Enter}');
    expect(screen.getByText('A view needs a name')).toBeInTheDocument();
    expect(toJSON(doc).views[1]?.title).toBe('Mine');
    // The old title is kept in the field.
    expect(field).toHaveValue('Mine');
    await user.clear(field);
    await user.type(field, 'Checkout path{Enter}');
    expect(toJSON(doc).views[1]?.title).toBe('Checkout path');
    expect(tab('Checkout path, custom view')).toBeInTheDocument();

    await user.dblClick(tab('Checkout path, custom view'));
    await user.type(screen.getByRole('textbox', { name: 'View name' }), ' again{Escape}');
    expect(toJSON(doc).views[1]?.title).toBe('Checkout path');
  });

  it('renames from the menu', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Switcher />, deck);
    await user.click(screen.getByRole('button', { name: 'View options for Mine' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const field = await screen.findByRole('textbox', { name: 'View name' });
    await user.clear(field);
    await user.type(field, 'Ops{Enter}');
    expect(toJSON(doc).views[1]?.title).toBe('Ops');
  });

  it('deletes after confirming, selects the view on the left, and Undo restores it', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Switcher />, deck);
    await user.click(tab('Mine, custom view'));
    await user.click(screen.getByRole('button', { name: 'View options for Mine' }));
    await user.click(screen.getByRole('menuitem', { name: /Delete view/ }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete view "Mine"?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(toJSON(doc).views.map((v) => v.id)).toEqual(['sys']);
    expect(useUiStore.getState().currentViewId).toBe('sys');
    expect(screen.getByText('View "Mine" deleted')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(toJSON(doc).views[1]).toEqual(deck.views[1]);
  });

  it('cannot delete the last view, and says why', async () => {
    const user = userEvent.setup();
    renderWithEditor(
      <Switcher />,
      deckOf({ ...deck, views: [{ id: 'only', type: 'custom', title: 'Only' }] }),
    );
    await user.click(screen.getByRole('button', { name: 'View options for Only' }));
    const item = screen.getByRole('menuitem', { name: /Delete view/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAccessibleDescription('A deck needs at least one view');
    act(() => undefined);
  });
});
