import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { Canvas } from '../canvas';
import { useEditorShortcuts } from '../use-canvas-shortcuts';
import { CanvasShell } from './canvas-shell';
import { DetailDrawer } from './detail-drawer';
import { loadShellPrefs } from './shell-prefs';
import { useShellShortcuts } from './use-shell-shortcuts';

function Shell() {
  useEditorShortcuts();
  useShellShortcuts();
  const deck = useDeckSnapshot(useEditor().doc);
  return (
    <MemoryRouter>
      <CanvasShell canvas={<Canvas />}>
        <DetailDrawer deck={deck} />
      </CanvasShell>
    </MemoryRouter>
  );
}

const shop = deckOf({
  name: 'Shop',
  nodes: [
    { id: 'a', type: 'service', title: 'Orders', position: { x: 0, y: 0 } },
    { id: 'b', type: 'database', title: 'Stock', position: { x: 300, y: 0 } },
    { id: 'c', type: 'client', title: 'Web', position: { x: 600, y: 0 } },
  ],
  groups: [{ id: 'g', title: 'Core' }],
});

const ui = () => useUiStore.getState();
const drawer = () => screen.queryByRole('complementary', { name: 'Details' });

function setup() {
  const env = renderWithEditor(<Shell />, shop);
  return { ...env, user: userEvent.setup() };
}

function focusNode(id: string) {
  act(() => {
    ui().select({ nodes: [id] });
    ui().focus(id);
  });
  act(() => {
    document.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.focus();
  });
}

describe('DetailDrawer (018 US3, contract "Detail drawer")', () => {
  it('opens only on request: Enter on a component, with the title focused', async () => {
    const { user } = setup();
    focusNode('a');
    expect(drawer()).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(drawer()).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Title' })).toHaveFocus();
    });
  });

  it('does not open on a double-click, which renames in place (019 FR-001)', () => {
    setup();
    fireEvent.doubleClick(screen.getByRole('group', { name: 'Service: Orders' }));
    expect(drawer()).not.toBeInTheDocument();
    expect(ui().selection.nodes).toEqual(['a']);
    expect(screen.getByRole('textbox', { name: 'Component title' })).toBeInTheDocument();
  });

  it('toggles with ⌘⇧D, and shows the bulk editor for several components', async () => {
    const { user } = setup();
    act(() => {
      ui().select({ nodes: ['a', 'b', 'c'] });
    });
    await user.keyboard('{Meta>}{Shift>}d{/Shift}{/Meta}');
    const details = drawer();
    if (details === null) throw new Error('no drawer');
    expect(within(details).getByText('3 components selected')).toBeInTheDocument();
    await user.keyboard('{Meta>}{Shift>}d{/Shift}{/Meta}');
    expect(drawer()).not.toBeInTheDocument();
  });

  it('closes with Esc (after leaving a field) and gives focus back to the component', async () => {
    const { user } = setup();
    focusNode('a');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Title' })).toHaveFocus();
    });
    await user.keyboard('{Escape}');
    expect(drawer()).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(drawer()).not.toBeInTheDocument();
    expect(ui().focusedId).toBe('a');
    expect(ui().selection.nodes).toEqual(['a']);
  });

  it('closes with "Close details" and when the selection is cleared', async () => {
    const { user } = setup();
    act(() => {
      ui().select({ nodes: ['a'] });
      ui().openDrawer();
    });
    await user.click(screen.getByRole('button', { name: 'Close details' }));
    expect(drawer()).not.toBeInTheDocument();

    act(() => {
      ui().openDrawer();
    });
    act(() => {
      ui().clearSelection();
    });
    expect(drawer()).not.toBeInTheDocument();
  });

  it('follows the selection while open', () => {
    setup();
    act(() => {
      ui().select({ nodes: ['a'] });
      ui().openDrawer();
    });
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Orders');
    act(() => {
      ui().select({ nodes: ['b'] });
    });
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Stock');
  });

  it('never changes the canvas box when it opens (FR-002)', () => {
    setup();
    const box = screen.getByTestId('shell-canvas');
    act(() => {
      ui().select({ nodes: ['a'] });
      ui().openDrawer();
    });
    expect(screen.getByTestId('shell-canvas')).toBe(box);
    expect(box).toHaveClass('absolute', 'inset-0');
    expect(box).not.toContainElement(drawer());
  });

  it('shows the deck in Deck settings mode, whatever is selected', () => {
    setup();
    act(() => {
      ui().select({ nodes: ['a'] });
      ui().openDrawer('deck');
    });
    expect(within(drawer() ?? document.body).getByRole('heading', { name: 'Shop' })).toBeVisible();
  });
});

describe('Drawer grip (FR-025)', () => {
  it('is a separator resized by keys and saved per deck', async () => {
    const { user } = setup();
    act(() => {
      ui().resetForDeck('deck-1');
      ui().select({ nodes: ['a'] });
      ui().openDrawer();
    });
    // Opening focuses the title first.
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Title' })).toHaveFocus();
    });
    const grip = screen.getByRole('separator', { name: 'Resize details' });
    expect(grip).toHaveAttribute('aria-orientation', 'vertical');
    expect(grip).toHaveAttribute('aria-valuemin', '320');
    expect(grip).toHaveAttribute('aria-valuemax', '560');
    expect(grip).toHaveAttribute('aria-valuenow', '360');
    act(() => {
      grip.focus();
    });
    await user.keyboard('{ArrowLeft}');
    expect(grip).toHaveAttribute('aria-valuenow', '368');
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(grip).toHaveAttribute('aria-valuenow', '328');
    await user.keyboard('{End}');
    expect(grip).toHaveAttribute('aria-valuenow', '560');
    await user.keyboard('{Home}');
    expect(grip).toHaveAttribute('aria-valuenow', '320');
    expect(loadShellPrefs('deck-1').drawerWidth).toBe(320);
    localStorage.clear();
  });

  it('resizes by dragging and saves once, on release', () => {
    setup();
    act(() => {
      ui().resetForDeck('deck-2');
      ui().select({ nodes: ['a'] });
      ui().openDrawer();
    });
    const grip = screen.getByRole('separator', { name: 'Resize details' });
    fireEvent.pointerDown(grip, { clientX: 1000, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 900, pointerId: 1 });
    expect(grip).toHaveAttribute('aria-valuenow', '460');
    expect(loadShellPrefs('deck-2').drawerWidth).toBe(360);
    fireEvent.pointerUp(grip, { clientX: 900, pointerId: 1 });
    expect(loadShellPrefs('deck-2').drawerWidth).toBe(460);
    localStorage.clear();
  });
  it('shows the enum drawer and closes it when the enum is removed (052)', () => {
    const withEnum = deckOf({
      name: 'Shop',
      nodes: [],
      enums: [{ id: 'e1', name: 'order_status', values: [{ id: 'v1', name: 'new' }] }],
    });
    const env = renderWithEditor(<Shell />, withEnum);
    act(() => {
      ui().openEnumDrawer('e1');
    });
    expect(screen.getByRole('heading', { name: 'order_status' })).toBeInTheDocument();
    expect(screen.getByText('Enum · 1 value')).toBeInTheDocument();
    act(() => {
      env.editor().removeEnum('e1');
    });
    expect(drawer()).not.toBeInTheDocument();
    expect(ui().drawer.open).toBe(false);
  });
});
