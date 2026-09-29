import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { renderWithEditor } from '../../test/render-canvas';
import { actionDeck } from '../../test/action-fixtures';
import { Canvas } from '../canvas';
import { ConfirmDeleteDialog } from '../confirm-delete-dialog';
import { useShellShortcuts } from '../shell/use-shell-shortcuts';
import { useEditorShortcuts } from '../use-canvas-shortcuts';
import { CanvasMenu } from './canvas-menu';
import { SelectionToolbar } from './selection-toolbar';

const ui = () => useUiStore.getState();

function Harness() {
  useEditorShortcuts();
  useShellShortcuts();
  const deck = useDeckSnapshot(useEditor().doc);
  return (
    <>
      <Canvas />
      <SelectionToolbar />
      <CanvasMenu />
      <ConfirmDeleteDialog deck={deck} />
    </>
  );
}

function setup() {
  const env = renderWithEditor(<Harness />, actionDeck);
  return { ...env, user: userEvent.setup() };
}

const card = (name: string) => screen.getByRole('group', { name });
const menu = () => screen.getByRole('menu', { name: /^Actions for / });
const items = () =>
  within(menu())
    .getAllByRole('menuitem')
    .map((item) => item.textContent);

function focusCard(id: string) {
  act(() => {
    ui().select({ nodes: [id] });
    ui().focus(id);
  });
  act(() => {
    document.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.focus();
  });
}

describe('CanvasMenu (019 US5)', () => {
  it('right-click selects an unselected card and opens its menu', () => {
    setup();
    fireEvent.contextMenu(card('Service: A'), { clientX: 40, clientY: 50 });
    expect(ui().selection.nodes).toEqual(['a']);
    expect(screen.getByRole('menu', { name: 'Actions for A' })).toBeInTheDocument();
    expect(items()).toEqual([
      'Open detailsEnter',
      'RenameF2',
      'CopyCtrl+C',
      'CutCtrl+X',
      'DuplicateCtrl+D',
      'Copy JSONCtrl+Shift+C',
      'GroupCtrl+G',
      'Align',
      'Arrange',
      'Pin',
      'DeleteDelete',
    ]);
    // Submenus say so (contract R10).
    expect(within(menu()).getByRole('menuitem', { name: 'Arrange' })).toHaveAttribute(
      'aria-haspopup',
      'menu',
    );
    const del = within(menu()).getByRole('menuitem', { name: /Delete/ });
    expect(del.querySelector('.lucide-trash2, .lucide-trash-2')).not.toBeNull();
  });

  it('renames from the menu, focus landing in the title field', async () => {
    const { user } = setup();
    fireEvent.contextMenu(card('Service: A'), { clientX: 40, clientY: 50 });
    await user.click(within(menu()).getByRole('menuitem', { name: /Rename/ }));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Component title' })).toHaveFocus();
    });
  });

  it('keeps a multi-selection when right-clicking inside it', () => {
    setup();
    act(() => {
      ui().select({ nodes: ['a', 'b'] });
    });
    fireEvent.contextMenu(card('Database: B'), { clientX: 40, clientY: 50 });
    expect(ui().selection.nodes).toEqual(['a', 'b']);
    expect(screen.getByRole('menu', { name: 'Actions for 2 components' })).toBeInTheDocument();
  });

  it('opens the canvas menu on the empty canvas and adds at the click point', async () => {
    const { user, doc } = setup();
    const pane = document.querySelector('.react-flow__pane');
    if (pane === null) throw new Error('no pane');
    fireEvent.contextMenu(pane, { clientX: 300, clientY: 200 });
    expect(screen.getByRole('menu', { name: 'Actions for canvas' })).toBeInTheDocument();
    expect(items()).toEqual([
      'PasteCtrl+V',
      'Add component',
      'Add stickyN',
      'Select allCtrl+A',
      'FitCtrl+0',
    ]);
    // Nothing was copied yet (016 contract): Paste stays visible, disabled, with its reason.
    const paste = within(menu()).getByRole('menuitem', { name: /Paste/ });
    expect(paste).toHaveAttribute('aria-disabled', 'true');
    expect(paste.getAttribute('title')).toMatch(/to paste/);
    await user.click(within(menu()).getByRole('menuitem', { name: 'Add component' }));
    const sub = await screen.findByRole('menu', { name: 'Add component' });
    expect(
      within(sub)
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Service1', 'Database2', 'Queue3', 'Gateway4', 'Client5', 'External6']);
    act(() => {
      within(sub)
        .getByRole('menuitem', { name: /Database/ })
        .focus();
    });
    await user.keyboard('{Enter}');
    expect(toJSON(doc).nodes.at(-1)).toMatchObject({
      type: 'database',
      title: 'Untitled database',
    });
    expect(ui().titleEdit).toMatchObject({ isNew: true });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens with ⇧F10 on a focused card, first item focused; Esc returns focus', async () => {
    const { user } = setup();
    focusCard('a');
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await waitFor(() => {
      expect(within(menu()).getByRole('menuitem', { name: /Open details/ })).toHaveFocus();
    });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() => {
      expect(card('Service: A')).toHaveFocus();
    });
    expect(ui().selection.nodes).toEqual(['a']);
  });

  it('opens with the ContextMenu key and from "More actions"', async () => {
    const { user } = setup();
    focusCard('a');
    await user.keyboard('{ContextMenu}');
    expect(screen.getByRole('menu', { name: 'Actions for A' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    const more = screen.getByRole('button', { name: 'More actions' });
    await user.click(more);
    expect(screen.getByRole('menu', { name: 'Actions for A' })).toBeInTheDocument();
    await waitFor(() => {
      expect(within(menu()).getByRole('menuitem', { name: /Open details/ })).toHaveFocus();
    });
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(more).toHaveFocus();
    });
  });

  it('shows only non-editing actions in flow mode', () => {
    setup();
    act(() => {
      ui().openFlow('f');
    });
    fireEvent.contextMenu(card('Service: A'), { clientX: 40, clientY: 50 });
    expect(items()).toEqual(['Open detailsEnter', 'CopyCtrl+C', 'Copy JSONCtrl+Shift+C']);
    expect(ui().activeFlow).not.toBeNull();
  });

  it('asks for confirmation on Delete, as the Delete key does (FR-038)', async () => {
    const { user } = setup();
    fireEvent.contextMenu(card('Service: A'), { clientX: 40, clientY: 50 });
    await user.click(within(menu()).getByRole('menuitem', { name: /Delete/ }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('explains Delete group in its tooltip and ungroups', async () => {
    const { user, doc } = setup();
    act(() => {
      ui().select({ groups: ['g'] });
    });
    fireEvent.contextMenu(screen.getByRole('button', { name: /^Core group/ }), {
      clientX: 10,
      clientY: 10,
    });
    expect(items()).toEqual([
      'Open detailsEnter',
      'RenameF2',
      'CollapseSpace',
      'Select members',
      'CopyCtrl+C',
      'CutCtrl+X',
      'DuplicateCtrl+D',
      'Delete group',
    ]);
    const item = within(menu()).getByRole('menuitem', { name: 'Delete group' });
    expect(item).toHaveAttribute('title', 'Members move to the parent level');
    await user.click(item);
    expect(toJSON(doc).groups).toEqual([]);
  });

  it('copies JSON with ⇧⌘C (019 FR-036)', async () => {
    const { user } = setup();
    // After setup: user-event installs its own clipboard stub.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    focusCard('a');
    await user.keyboard('{Shift>}{Control>}c{/Control}{/Shift}');
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Copied JSON for A')).toBeInTheDocument();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
});
