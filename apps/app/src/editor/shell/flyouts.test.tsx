import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { playbackDeck } from '../../test/flow-fixtures';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { Canvas } from '../canvas';
import { CanvasShell } from './canvas-shell';
import { Flyouts } from './flyouts';
import { Rail } from './rail';
import { shortcutLabel } from './shortcuts';
import { useShellShortcuts } from './use-shell-shortcuts';

function Shell() {
  useShellShortcuts();
  const deck = useDeckSnapshot(useEditor().doc);
  return (
    <MemoryRouter>
      <CanvasShell canvas={<Canvas />}>
        <Rail />
        <Flyouts deck={deck} />
      </CanvasShell>
    </MemoryRouter>
  );
}

const shop = deckOf({
  name: 'Shop',
  nodes: [
    { id: 'a', type: 'service', title: 'Orders', position: { x: 0, y: 0 } },
    { id: 'b', type: 'database', title: 'Stock', position: { x: 300, y: 0 } },
  ],
  rules: {
    R: { title: 'Delivery tier', hitPolicy: 'first', inputs: [], outputs: [], rows: [] },
  },
});

const ui = () => useUiStore.getState();
const rail = () => screen.getByRole('toolbar', { name: 'Canvas tools' });
const railButton = (name: string | RegExp) => within(rail()).getByRole('button', { name });

function setup(file = shop) {
  const env = renderWithEditor(<Shell />, file);
  return { ...env, user: userEvent.setup() };
}

describe('Rail and flyouts (018 US2, contract "Rail" and "Flyout")', () => {
  it('opens one flyout at a time beside the rail', async () => {
    const { user } = setup();
    await user.click(railButton('Outline'));
    expect(screen.getByRole('dialog', { name: 'Outline' })).toBeInTheDocument();
    expect(railButton('Outline')).toHaveAttribute('aria-expanded', 'true');

    await user.click(railButton('Flows & features'));
    expect(screen.queryByRole('dialog', { name: 'Outline' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Flows & features' })).toBeInTheDocument();
    expect(railButton('Outline')).toHaveAttribute('aria-expanded', 'false');

    await user.click(railButton('Rules'));
    const rules = screen.getByRole('dialog', { name: 'Rules' });
    expect(within(rules).getByRole('link', { name: /Delivery tier/ })).toBeInTheDocument();
    expect(within(rules).getByRole('button', { name: 'Open rule editor' })).toBeInTheDocument();
  });

  it('moves focus into a flyout and back to its rail button on Esc', async () => {
    const { user } = setup();
    await user.click(railButton('Add component'));
    const palette = screen.getByRole('dialog', { name: 'Components' });
    await waitFor(() => {
      expect(palette).toContainElement(document.activeElement as HTMLElement);
    });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Components' })).not.toBeInTheDocument();
    expect(railButton('Add component')).toHaveFocus();
  });

  it('clears a filter with the first Esc and closes with the second', async () => {
    const { user } = setup(playbackDeck);
    await user.click(railButton('Flows & features'));
    const filter = screen.getByRole('searchbox', { name: 'Filter flows' });
    await user.type(filter, 'order');
    await user.keyboard('{Escape}');
    expect(filter).toHaveValue('');
    expect(screen.getByRole('dialog', { name: 'Flows & features' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Flows & features' })).not.toBeInTheDocument();
  });

  it('closes an unpinned flyout on a canvas click, keeps a pinned one', async () => {
    const { user } = setup();
    await user.click(railButton('Outline'));
    fireEvent.pointerDown(screen.getByLabelText('Diagram canvas'));
    expect(screen.queryByRole('dialog', { name: 'Outline' })).not.toBeInTheDocument();

    await user.click(railButton('Outline'));
    await user.click(screen.getByRole('button', { name: 'Pin Outline' }));
    expect(screen.getByRole('button', { name: 'Pin Outline' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.pointerDown(screen.getByLabelText('Diagram canvas'));
    expect(screen.getByRole('dialog', { name: 'Outline' })).toBeInTheDocument();
  });

  it('brings the pinned flyout back when a temporary one closes', async () => {
    const { user } = setup();
    await user.click(railButton('Outline'));
    await user.click(screen.getByRole('button', { name: 'Pin Outline' }));
    await user.click(railButton('Add component'));
    expect(screen.getByRole('dialog', { name: 'Components' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close Components' }));
    expect(screen.getByRole('dialog', { name: 'Outline' })).toBeInTheDocument();
  });

  it('adds a kind at the view centre with 1–6 while the palette is open', async () => {
    const { user, doc, editor } = setup(deckOf({}));
    await user.keyboard('3');
    expect(editor().canUndo()).toBe(false);
    act(() => {
      ui().openFlyout('palette');
    });
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await user.keyboard('3');
    expect(doc.getArray('nodes').length).toBe(1);
    // The palette closes after adding unless it is pinned.
    expect(ui().flyout).toBeNull();
    // The new card is being named (019 FR-011).
    expect(ui().titleEdit).toMatchObject({ target: 'node', isNew: true });
  });

  it('keeps a pinned palette open while the new card is named (019 US2)', async () => {
    const { user } = setup(deckOf({}));
    act(() => {
      ui().openFlyout('palette');
      ui().togglePin();
    });
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await user.keyboard('2');
    expect(ui().flyout).toBe('palette');
    expect(ui().titleEdit).toMatchObject({ isNew: true });
  });

  it('shows the flow steps in flow mode, and pins Flows during a recording', () => {
    setup(playbackDeck);
    const flow = playbackDeck.flows[0];
    if (flow === undefined) throw new Error('no flow');
    act(() => {
      ui().openFlyout('outline');
      ui().togglePin();
      ui().startRecording('New flow', null);
    });
    expect(screen.getByRole('dialog', { name: 'Flows & features' })).toBeInTheDocument();
    expect(ui().pinnedFlyout).toBe('flows');
  });

  it('opens flyouts with ⌥1 and ⌥2, even from a text field', async () => {
    const { user } = setup();
    await user.keyboard('{Alt>}1{/Alt}');
    expect(screen.getByRole('dialog', { name: 'Outline' })).toBeInTheDocument();
    await user.keyboard('{Alt>}2{/Alt}');
    expect(screen.getByRole('dialog', { name: 'Flows & features' })).toBeInTheDocument();
  });
});

describe('Rail tools (018 R8)', () => {
  it('names every item, shows the active tool, and Group needs two or more components', async () => {
    const { user } = setup();
    for (const name of [
      'Select',
      'Add component',
      'Sticky note',
      'Group',
      'Connector',
      'Outline',
      'Flows & features',
      'Rules',
      'Search',
      'Problems',
    ]) {
      expect(railButton(new RegExp(`^${name}`))).toBeInTheDocument();
    }
    expect(railButton('Select')).toHaveAttribute('aria-pressed', 'true');
    await user.click(railButton('Sticky note'));
    expect(railButton('Sticky note')).toHaveAttribute('aria-pressed', 'true');
    expect(railButton('Group')).toHaveAttribute('aria-disabled', 'true');
    await user.click(railButton('Group'));
    expect(ui().tool).toBe('sticky');
  });

  it('groups the selection from the rail (016 FR-010)', async () => {
    const { user } = setup();
    act(() => {
      ui().select({ nodes: ['a', 'b'] });
    });
    expect(railButton('Group')).not.toHaveAttribute('aria-disabled');
    await user.hover(railButton('Group'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(`Group${shortcutLabel('group')}`);
    await user.click(railButton('Group'));
    expect(ui().titleEdit).toMatchObject({ target: 'group', isNew: true });
  });

  it('shows the tooltip with the shortcut after a short wait', async () => {
    const { user } = setup();
    await user.hover(railButton('Connector'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('ConnectorL');
  });

  it('sets tools with V, S and L, and Esc goes back to Select', async () => {
    const { user } = setup();
    await user.keyboard('s');
    expect(ui().tool).toBe('sticky');
    await user.keyboard('l');
    expect(ui().tool).toBe('connector');
    await user.keyboard('v');
    expect(ui().tool).toBe('select');
  });

  it('C opens the palette when no card is focused (§g-49)', async () => {
    const { user } = setup();
    await user.keyboard('c');
    expect(ui().flyout).toBe('palette');
  });

  it('shows a Problems count badge in its name', () => {
    setup(playbackDeck);
    expect(railButton(/^Problems/)).toBeInTheDocument();
  });
});
