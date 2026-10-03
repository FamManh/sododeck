import { toJSON } from '@sododeck/model';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { actionDeck } from '../../test/action-fixtures';
import { renderWithEditor } from '../../test/render-canvas';
import { Canvas } from '../canvas';
import { useShellShortcuts } from '../shell/use-shell-shortcuts';
import { useEditorShortcuts } from '../use-canvas-shortcuts';
import { CanvasMenu } from './canvas-menu';
import { SelectionToolbar } from './selection-toolbar';

const ui = () => useUiStore.getState();

function Harness() {
  useEditorShortcuts();
  useShellShortcuts();
  return (
    <>
      <input aria-label="Notes" />
      <Canvas />
      <SelectionToolbar />
      <CanvasMenu />
    </>
  );
}

function setup() {
  const env = renderWithEditor(<Harness />, actionDeck);
  return { ...env, user: userEvent.setup() };
}

function focusCard(id: string) {
  act(() => {
    ui().select({ nodes: [id] });
    ui().focus(id);
  });
  act(() => {
    document.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.focus();
  });
}

const card = (name: string) => screen.getByRole('group', { name });
const bar = () => screen.getByRole('toolbar', { name: /^Selection:/ });

describe('quick edit from the keyboard (019 US7)', () => {
  it('⌘E focuses the toolbar; arrows move; Esc returns to the card with the selection kept', async () => {
    const { user } = setup();
    focusCard('a');
    await user.keyboard('{Control>}e{/Control}');
    expect(within(bar()).getByRole('button', { name: 'Open details' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(within(bar()).getByRole('button', { name: 'Kind: Service' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(within(bar()).getByRole('button', { name: 'More actions' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(card('Service: A')).toHaveFocus();
    expect(ui().selection.nodes).toEqual(['a']);
  });

  it('picks a kind with the keyboard only and lands back on the Kind button', async () => {
    const { user, doc } = setup();
    focusCard('a');
    await user.keyboard('{Control>}e{/Control}{ArrowRight}{Enter}');
    const filter = await screen.findByRole('searchbox', { name: 'Filter kind' });
    expect(filter).toHaveFocus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(toJSON(doc).nodes[0]?.type).not.toBe('service');
    await waitFor(() => {
      expect(within(bar()).getByRole('button', { name: /^Kind: / })).toHaveFocus();
    });
  });

  it('ignores ⌘E in a text field and without a toolbar', async () => {
    const { user } = setup();
    act(() => {
      screen.getByRole('textbox', { name: 'Notes' }).focus();
    });
    await user.keyboard('{Control>}e{/Control}');
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveFocus();
  });

  it('Tab from a selected card enters the toolbar; Tab past its end returns, then leaves', async () => {
    const { user } = setup();
    focusCard('a');
    await user.tab();
    expect(within(bar()).getByRole('button', { name: 'Open details' })).toHaveFocus();
    await user.tab();
    expect(card('Service: A')).toHaveFocus();
    await user.tab();
    expect(document.activeElement?.closest('[data-quick-toolbar]')).toBeNull();
  });

  it('P on a selected connection opens the protocol picker; Enter still edits the label', async () => {
    const { user, doc } = setup();
    act(() => {
      ui().select({ edges: ['e'] });
      ui().focusEdge('e');
    });
    act(() => {
      document.querySelector<HTMLElement>('[data-canvas]')?.focus();
    });
    expect(bar()).toHaveAccessibleName('Selection: connection A → B');
    expect(
      within(bar())
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Label', 'Protocol: HTTP', 'Direction: Forward', 'Line style', 'More actions']);
    await user.keyboard('p');
    const dialog = await screen.findByRole('dialog', { name: 'Protocol' });
    await user.click(within(dialog).getByRole('option', { name: 'gRPC' }));
    expect(toJSON(doc).edges[0]?.protocol).toBe('grpc');
    // Reached with E from a card, as users do (003): Enter opens the edge popover.
    focusCard('a');
    await user.keyboard('e{Enter}');
    expect(ui().popover).toEqual({ kind: 'edge', edgeId: 'e' });
  });

  it('shows the group toolbar; ⇧⌘G ungroups in one undo step; Space still collapses', async () => {
    const { user, doc, editor } = setup();
    act(() => {
      ui().select({ groups: ['g'] });
      ui().focus('group:g');
    });
    act(() => {
      document.querySelector<HTMLElement>('[data-node-id="group:g"]')?.focus();
    });
    expect(
      within(bar())
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Rename', 'Ungroup', 'Collapse', 'Select members', 'Colour: none', 'More actions']);
    await user.keyboard(' ');
    expect(within(bar()).getByRole('button', { name: 'Expand' })).toBeInTheDocument();
    await user.keyboard('{Shift>}{Control>}g{/Control}{/Shift}');
    expect(toJSON(doc).groups).toEqual([]);
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).groups.map((g) => g.id)).toEqual(['g']);
  });

  it('Select members switches the toolbar to the multi-selection variant', async () => {
    const { user } = setup();
    act(() => {
      ui().select({ groups: ['g'] });
    });
    await user.click(within(bar()).getByRole('button', { name: 'Select members' }));
    expect(ui().selection.nodes).toEqual(['a', 'b']);
    expect(bar()).toHaveAccessibleName('Selection: 2 components');
  });
});
