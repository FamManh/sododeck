import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { useSaveStatusStore } from '../../storage/save-status';
import { playbackDeck } from '../../test/flow-fixtures';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { SaveContext } from '../save-context';
import { useCurrentViewSync } from '../views/use-view-sync';
import { DeckIsland } from './deck-island';

function Island() {
  useCurrentViewSync();
  const deck = useDeckSnapshot(useEditor().doc);
  return (
    <MemoryRouter>
      <DeckIsland deck={deck} />
    </MemoryRouter>
  );
}

const shop = deckOf({
  name: 'Shop',
  nodes: [{ id: 'a', type: 'service', title: 'A' }],
  groups: [{ id: 'core', title: 'Core' }],
});

const island = () => screen.getByRole('toolbar', { name: 'Deck' });

describe('DeckIsland (018 contract "Deck island")', () => {
  it('holds the menu, the deck name, the save status and the views', () => {
    renderWithEditor(<Island />, shop);
    expect(within(island()).getByRole('button', { name: 'Deck menu' })).toBeInTheDocument();
    expect(within(island()).getByRole('button', { name: 'Rename deck' })).toHaveTextContent('Shop');
    expect(within(island()).getByText('Demo · not saved')).toBeInTheDocument();
    expect(within(island()).getByRole('tablist', { name: 'Views' })).toBeInTheDocument();
  });

  it('shows the save status as an icon named by its words (§g-51)', () => {
    useSaveStatusStore.getState().reset();
    renderWithEditor(
      <SaveContext
        value={{ mode: 'stored', flush: () => Promise.resolve(), markExported: () => {} }}
      >
        <Island />
      </SaveContext>,
      shop,
    );
    expect(within(island()).getByText('Saved in this browser')).toHaveClass('sr-only');
  });

  it('renames the deck in place in one undo step', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(<Island />, shop);
    await user.click(screen.getByRole('button', { name: 'Rename deck' }));
    const field = screen.getByRole('textbox', { name: 'Deck name' });
    await user.clear(field);
    await user.type(field, 'Store{Enter}');
    expect(toJSON(doc).name).toBe('Store');
    expect(editor().undo()).toBe(true);
    expect(toJSON(doc).name).toBe('Shop');
  });

  it('offers the library, import, export, deck settings and JSON in its menu', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Island />, shop);
    await user.click(screen.getByRole('button', { name: 'Deck menu' }));
    const menu = screen.getByRole('menu', { name: 'Deck menu' });
    for (const name of ['All decks', 'Import…', 'Export…', 'Deck settings', /Show JSON/]) {
      expect(within(menu).getByRole('menuitem', { name })).toBeInTheDocument();
    }
    await user.click(within(menu).getByRole('menuitem', { name: /Show JSON/ }));
    expect(useUiStore.getState().jsonShown).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Deck menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Deck settings' }));
    expect(useUiStore.getState().drawer).toMatchObject({ open: true, mode: 'deck' });
  });

  it('opens and closes the DBML / SQL drawer from its menu (054)', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Island />, shop);
    await user.click(screen.getByRole('button', { name: 'Deck menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Show DBML / SQL' }));
    expect(useUiStore.getState().jsonPanel.codeDrawer.open).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Deck menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Hide DBML / SQL' }));
    expect(useUiStore.getState().jsonPanel.codeDrawer.open).toBe(false);
  });

  it('switches the theme from its menu (§g-60)', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Island />, shop);
    await user.click(screen.getByRole('button', { name: 'Deck menu' }));
    const first = screen.getByRole('menuitem', { name: /^(Dark|Light) mode$/ });
    const label = first.textContent;
    await user.click(first);
    await user.click(screen.getByRole('button', { name: 'Deck menu' }));
    expect(screen.getByRole('menuitem', { name: /^(Dark|Light) mode$/ }).textContent).not.toBe(
      label,
    );
  });

  it('opens the Export dialog from "Export…" and returns focus to the menu button (012)', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Island />, shop);
    await user.click(screen.getByRole('button', { name: 'Deck menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export…' }));
    expect(useUiStore.getState().exportDialog).toEqual({
      open: true,
      returnFocus: screen.getByRole('button', { name: 'Deck menu' }),
    });
  });

  it('opens Import SQL or DBML from the menu, and the last report once there is one (044)', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Island />, shop);
    await user.click(screen.getByRole('button', { name: 'Deck menu' }));
    expect(screen.queryByRole('menuitem', { name: 'Last import report' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Import SQL or DBML…' }));
    expect(useUiStore.getState().importDialog.open).toBe(true);
    act(() => {
      useUiStore.getState().setImportReport({
        deckId: null,
        source: { format: 'sql', dialect: null },
        mapped: {
          tables: 1,
          relationships: 0,
          enums: 0,
          indexes: 0,
          checks: 0,
          groups: 0,
          stickies: 0,
        },
        skipped: [],
        changed: [],
        suggestions: null,
      });
    });
    await user.click(screen.getByRole('button', { name: 'Deck menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Last import report' }));
    expect(useUiStore.getState().flyout).toBe('import-report');
  });

  it('switches views and replaces them with the session chip while recording (011)', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Island />, shop);
    await user.click(screen.getByRole('tab', { name: 'Flows view' }));
    expect(screen.getByRole('tab', { name: 'Flows view' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    act(() => {
      useUiStore.getState().startRecording('New flow', null);
    });
    expect(screen.queryByRole('tablist', { name: 'Views' })).not.toBeInTheDocument();
  });

  it('offers Tidy layout in the current view’s menu (§g-46)', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Island />, shop);
    await user.click(screen.getByRole('button', { name: 'View options for Overview' }));
    expect(screen.getByRole('menuitem', { name: /Tidy layout/ })).toBeInTheDocument();
  });

  it('adds the flow chip in flow mode, which exits it', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Island />, playbackDeck);
    const flow = playbackDeck.flows[0];
    if (flow === undefined) throw new Error('no flow');
    act(() => {
      useUiStore.getState().openFlow(flow.id);
    });
    await user.click(screen.getByRole('button', { name: `Exit flow ${flow.title}` }));
    expect(useUiStore.getState().activeFlow).toBeNull();
  });

  it('shows the drill breadcrumb as a chip only while drilled in (§g-46)', () => {
    renderWithEditor(<Island />, shop);
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
    act(() => {
      useUiStore
        .getState()
        .drillInto({ kind: 'group', id: 'core', viewport: { x: 0, y: 0, zoom: 1 } });
    });
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      'Overview view/Core',
    );
  });

  it('shows the views as one dropdown in a narrow window (FR-041)', async () => {
    const user = userEvent.setup();
    function Compact() {
      const deck = useDeckSnapshot(useEditor().doc);
      return (
        <MemoryRouter>
          <DeckIsland deck={deck} compact />
        </MemoryRouter>
      );
    }
    renderWithEditor(<Compact />, shop);
    expect(screen.queryByRole('tablist', { name: 'Views' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View: Overview' }));
    await user.click(screen.getByRole('menuitem', { name: 'Flows' }));
    expect(screen.getByRole('button', { name: 'View: Flows' })).toBeInTheDocument();
  });
});
