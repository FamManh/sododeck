import { emptySododeckFile } from '@sododeck/schema';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { isApplePlatform } from '../../lib/features';
import { useEditor } from '../../model/use-editor';
import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useUiStore } from '../../state/ui-store';
import { renderWithEditor } from '../../test/render-canvas';
import { useThemeStore } from '../../theme/theme-store';
import { TopBar } from '../top-bar';
import { useEditorShortcuts } from '../use-canvas-shortcuts';
import { CommandPalette } from './command-palette';

function shortcutLabel(): string {
  return isApplePlatform() ? '⌘K' : 'Ctrl+K';
}

function shortcutKeys(): string {
  return isApplePlatform() ? '{Meta>}k{/Meta}' : '{Control>}k{/Control}';
}

function paletteDeck() {
  const deck = emptySododeckFile();
  deck.name = 'Search deck';
  deck.groups.push({ id: 'core', title: 'Core services' });
  deck.nodes.push({ id: 'svc', type: 'service', title: 'Order Service', group: 'core' });
  deck.edges.push({ id: 'edge-1', from: 'svc', to: 'svc' });
  deck.flows.push({
    id: 'flow-1',
    title: 'Place order',
    steps: [
      { id: 'step-1', edge: 'edge-1' },
      { id: 'step-4', edge: 'edge-1', condition: 'Use Reattempt policy' },
    ],
  });
  deck.rules['rule-1'] = {
    title: 'Reattempt policy',
    description: 'Retry failed orders',
    hitPolicy: 'first',
    inputs: [],
    outputs: [],
    rows: [],
  };
  deck.stickies.push({
    id: 'note-1',
    text: 'Retry the order when payments time out',
    position: { x: 8, y: 12 },
  });
  return deck;
}

function Harness({
  openRules = vi.fn(),
  screenMode = 'canvas',
}: {
  openRules?: (ruleId?: string) => void;
  screenMode?: 'canvas' | 'rules';
}) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const [committed, setCommitted] = useState('');
  useEditorShortcuts({ canvas: screenMode === 'canvas' });

  return (
    <MemoryRouter>
      <TopBar
        deckName={deck.name ?? 'Untitled deck'}
        screen={screenMode}
        rulesCount={Object.keys(deck.rules).length}
      />
      <CommandPalette
        screen={screenMode}
        openRules={openRules}
        navigateToCanvas={() => undefined}
      />
      <label className="sr-only" htmlFor="scratch-field">
        Scratch
      </label>
      <input
        id="scratch-field"
        aria-label="Scratch"
        defaultValue=""
        onBlur={(event) => {
          setCommitted(event.currentTarget.value);
        }}
      />
      <output aria-label="Committed">{committed}</output>
    </MemoryRouter>
  );
}

describe('CommandPalette', () => {
  it('opens with the shortcut from a text field, focuses the input, and closes back to the prior focus', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Harness />, paletteDeck());

    const scratch = screen.getByRole('textbox', { name: 'Scratch' });
    await user.type(scratch, 'Draft');
    expect(scratch).toHaveFocus();

    await user.keyboard(shortcutKeys());
    const dialog = screen.getByRole('dialog', { name: 'Jump to' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search the deck' })).toHaveFocus();
    expect(screen.getByRole('combobox', { name: 'Search the deck' })).toHaveValue('');
    expect(screen.getByLabelText('Committed')).toHaveTextContent('Draft');

    await user.keyboard(shortcutKeys());
    expect(screen.queryByRole('dialog', { name: 'Jump to' })).not.toBeInTheDocument();
    expect(scratch).toHaveFocus();

    await user.keyboard(shortcutKeys());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Jump to' })).not.toBeInTheDocument();
    expect(scratch).toHaveFocus();
  });

  it('shows rule and step results for reattempt, with snippets, and Enter opens the first', async () => {
    const user = userEvent.setup();
    const openRules = vi.fn();
    renderWithEditor(<Harness openRules={openRules} />, paletteDeck());

    await user.keyboard(shortcutKeys());
    await user.type(screen.getByRole('combobox', { name: 'Search the deck' }), 'reattempt');

    const list = screen.getByRole('listbox', { name: 'Results' });
    const options = within(list).getAllByRole('option');
    expect(options[0]).toHaveTextContent('Reattempt policy');
    expect(options[0]).toHaveTextContent('Rule · First match');
    expect(options[1]).toHaveTextContent('Place order');
    expect(options[1]).toHaveTextContent('Step 2 · Place order');
    expect(options[1]).toHaveTextContent('Use Reattempt policy');

    await user.keyboard('{Enter}');
    expect(openRules).toHaveBeenCalledWith('rule-1');
    expect(screen.queryByRole('dialog', { name: 'Jump to' })).not.toBeInTheDocument();
  });

  it('opens the third result on ArrowDown twice and Enter', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Harness />, paletteDeck());

    await user.keyboard(shortcutKeys());
    await user.type(screen.getByRole('combobox', { name: 'Search the deck' }), 'order');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(useUiStore.getState().activeFlow).toMatchObject({ flowId: 'flow-1', stepId: 'step-1' });
  });

  it('shows no results for an unknown query and Enter does nothing', async () => {
    const user = userEvent.setup();
    const openRules = vi.fn();
    renderWithEditor(<Harness openRules={openRules} />, paletteDeck());

    await user.keyboard(shortcutKeys());
    await user.type(screen.getByRole('combobox', { name: 'Search the deck' }), 'zzqx');
    expect(screen.getByText('No results')).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(openRules).not.toHaveBeenCalled();
    expect(useUiStore.getState().activeFlow).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Jump to' })).toBeInTheDocument();
  });

  it('refreshes results when the deck changes while the palette is open', async () => {
    const user = userEvent.setup();
    const view = renderWithEditor(<Harness />, paletteDeck());

    await user.keyboard(shortcutKeys());
    const input = screen.getByRole('combobox', { name: 'Search the deck' });
    await user.type(input, 'zzqx');
    expect(screen.getByText('No results')).toBeInTheDocument();

    act(() => {
      view.editor().updateRule('rule-1', { title: 'zzqx policy' });
    });

    const list = await screen.findByRole('listbox', { name: 'Results' });
    expect(within(list).getByRole('option')).toHaveTextContent('zzqx policy');
  });

  it('opens from the top-bar jump button', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Harness />, paletteDeck());

    await user.click(screen.getByRole('button', { name: `Jump to… (${shortcutLabel()})` }));
    expect(screen.getByRole('dialog', { name: 'Jump to' })).toBeInTheDocument();
  });

  it('runs the theme command from the palette', async () => {
    const user = userEvent.setup();
    useThemeStore.setState({ theme: 'light' });
    renderWithEditor(<Harness />, paletteDeck());

    await user.keyboard(shortcutKeys());
    await user.type(screen.getByRole('combobox', { name: 'Search the deck' }), 'theme');
    await user.keyboard('{Enter}');

    expect(useThemeStore.getState().theme).toBe('dark');
  });

  describe('components hidden in the current view (011 FR-016)', () => {
    function viewsDeck() {
      const deck = paletteDeck();
      deck.views = [
        { id: 'no-core', type: 'custom', title: 'Edge only', excludeGroups: ['core'] },
        { id: 'all', type: 'system', title: 'Everything' },
      ];
      return deck;
    }

    it('keeps the view, says so in a toast, and "Show in" switches and selects', async () => {
      const user = userEvent.setup();
      renderWithEditor(<Harness />, viewsDeck());
      await user.keyboard(shortcutKeys());
      await user.type(screen.getByRole('combobox', { name: 'Search the deck' }), 'Order Service');
      expect(screen.getAllByRole('option')[0]).toHaveTextContent(
        'Service · Core services · Hidden in this view',
      );
      await user.keyboard('{Enter}');
      expect(useUiStore.getState().currentViewId).toBeNull();
      expect(useUiStore.getState().selection.nodes).toEqual([]);
      expect(screen.getByText('Order Service is hidden in this view')).toBeInTheDocument();
      const action = screen.getByRole('button', { name: 'Show in Everything' });
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      });
      expect(action).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(useUiStore.getState().currentViewId).toBe('all');
      expect(useUiStore.getState().selection.nodes).toEqual(['svc']);
    });

    it('says when no view shows the component, with no action', async () => {
      const user = userEvent.setup();
      const deck = viewsDeck();
      deck.views = [deck.views[0] as (typeof deck.views)[number]];
      renderWithEditor(<Harness />, deck);
      await user.keyboard(shortcutKeys());
      await user.type(screen.getByRole('combobox', { name: 'Search the deck' }), 'Order Service');
      await user.keyboard('{Enter}');
      expect(screen.getByText('Order Service is hidden in every view')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Show in/ })).not.toBeInTheDocument();
    });
  });
});
