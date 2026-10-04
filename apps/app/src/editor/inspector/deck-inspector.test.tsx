import { toJSON } from '@sododeck/model';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { inspectorDeck } from '../../test/inspector-fixtures';
import { editorWrapper } from '../../test/render-canvas';
import { TopBar } from '../top-bar';
import { DeckInspector } from './deck-inspector';

function Harness({ onOpenRules }: { onOpenRules?: () => void }) {
  const deck = useDeckSnapshot(useEditor().doc);
  return (
    <MemoryRouter>
      <TopBar deckName={deck.name ?? 'Untitled deck'} />
      <DeckInspector deck={deck} onOpenRules={onOpenRules} />
    </MemoryRouter>
  );
}

const withRules = {
  ...inspectorDeck,
  rules: {
    R: { title: 'Tier', hitPolicy: 'first' as const, inputs: [], outputs: [], rows: [] },
  },
};

function setup(onOpenRules?: () => void) {
  const { wrapper, doc, editor } = editorWrapper(withRules);
  return {
    ...render(<Harness onOpenRules={onOpenRules} />, { wrapper }),
    doc,
    editor,
    user: userEvent.setup(),
  };
}

describe('DeckInspector (story 2, FR-012)', () => {
  it('lists the deck problems first and never writes them into the deck (015 FR-010, FR-012)', async () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    act(() => {
      // A second Order Service → Pricing connection: a duplicate.
      editor().add('edges', { id: 'op2', from: 'o', to: 'p', label: 'quote' });
    });
    expect(await screen.findByRole('button', { name: /appears twice/ })).toBeInTheDocument();
    const after = toJSON(doc);
    expect(JSON.stringify(after)).not.toContain('problems');
    expect({ ...after, edges: before.edges }).toEqual(before);
  });

  it('selects the objects behind a problem row (015 US2)', async () => {
    const { editor, user } = setup();
    act(() => {
      editor().add('edges', { id: 'op2', from: 'o', to: 'p', label: 'quote' });
    });
    await user.click(await screen.findByRole('button', { name: /appears twice/ }));
    expect(useUiStore.getState().selection.edges).toEqual(['op', 'op2']);
  });

  it('renames the deck (the top bar follows) and refuses an empty name', async () => {
    const { user, doc } = setup();
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.keyboard('{Enter}');
    expect(screen.getByText('Name can’t be empty.')).toBeInTheDocument();
    expect(toJSON(doc).name).toBe('Logistics');
    await user.type(name, 'Delivery{Enter}');
    expect(toJSON(doc).name).toBe('Delivery');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Delivery');
  });

  it('edits the description and tags, one undo step each', async () => {
    const { user, doc, editor } = setup();
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Last mile.');
    await user.tab();
    await user.type(screen.getByRole('combobox', { name: 'Add tag' }), 'Logistics{Enter}');
    expect(toJSON(doc)).toMatchObject({ description: 'Last mile.', tags: ['Logistics'] });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).tags).toBeUndefined();
    expect(toJSON(doc).description).toBe('Last mile.');
  });

  it('shows the stats, opens the rules from "Rules n", and keeps the storage section', async () => {
    const open = vi.fn();
    const { user } = setup(open);
    const stats = screen.getByRole('list', { name: 'Deck summary' });
    expect(within(stats).getByText('Components').previousSibling).toHaveTextContent('4');
    expect(within(stats).getByText('Connections').previousSibling).toHaveTextContent('3');
    expect(within(stats).getByText('Flows').previousSibling).toHaveTextContent('2');
    await user.click(within(stats).getByRole('button', { name: 'Rules 1' }));
    expect(open).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: 'Storage' })).toBeInTheDocument();
  });

  it('reaches every control with Tab', async () => {
    const { user } = setup(() => undefined);
    const inspector = screen.getByRole('complementary', { name: 'Inspector' });
    const expected = [
      screen.getByRole('textbox', { name: 'Name' }),
      within(inspector).getByRole('radio', { name: 'Write' }),
      screen.getByRole('textbox', { name: 'Description' }),
      screen.getByRole('combobox', { name: 'Add tag' }),
      screen.getByRole('button', { name: 'Rules 1' }),
      screen.getByRole('button', { name: 'Export .sododeck.json' }),
    ];
    screen.getByRole('textbox', { name: 'Name' }).focus();
    for (const target of expected.slice(1)) {
      await user.tab();
      expect(target).toHaveFocus();
    }
  });
});

describe('DeckInspector › Database (041 US4)', () => {
  const tableDeck = {
    ...inspectorDeck,
    nodes: [
      ...inspectorDeck.nodes,
      { id: 'orders', type: 'db-table', title: 'orders', columns: [] },
    ],
  };

  function setupWith(file: typeof inspectorDeck) {
    const { wrapper, doc, editor } = editorWrapper(file);
    render(<Harness />, { wrapper });
    return { doc, editor, user: userEvent.setup() };
  }

  it('shows four switches, all on, under "Show on tables"', () => {
    setupWith(tableDeck);
    expect(screen.getByText('Database')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Show on tables' });
    const names = within(list)
      .getAllByRole('switch')
      .map((s) => (s as HTMLButtonElement).labels[0]?.textContent);
    expect(names).toEqual(['Data types', 'Nullable marker', 'Notes', 'Index footer']);
    for (const toggle of within(list).getAllByRole('switch')) expect(toggle).toBeChecked();
  });

  it('writes the hide flag in one undo step, and removes it when turned back on', async () => {
    const { doc, editor, user } = setupWith(tableDeck);
    await user.click(screen.getByRole('switch', { name: 'Notes' }));
    expect(toJSON(doc).tableDisplay).toEqual({ hideNotes: true });
    expect(screen.getByRole('switch', { name: 'Notes' })).not.toBeChecked();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).not.toHaveProperty('tableDisplay');
    await user.click(screen.getByRole('switch', { name: 'Data types' }));
    await user.click(screen.getByRole('switch', { name: 'Data types' }));
    expect(toJSON(doc)).not.toHaveProperty('tableDisplay');
  });

  it('shows the relationship controls at their defaults (042 FR-025)', () => {
    setupWith(tableDeck);
    expect(screen.getByText('Show on relationships')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Cardinality ends' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Labels' })).toHaveTextContent(
      'Follow Labels tool',
    );
    const notation = screen.getByRole('radiogroup', { name: 'Notation' });
    expect(within(notation).getByRole('radio', { name: "Crow's foot" })).toBeChecked();
  });

  it('writes each relationship setting in one undo step', async () => {
    const { doc, editor, user } = setupWith(tableDeck);
    await user.click(screen.getByRole('switch', { name: 'Cardinality ends' }));
    expect(toJSON(doc).relationshipDisplay).toEqual({ hideEnds: true });
    await user.click(screen.getByRole('radio', { name: '1 / n' }));
    expect(toJSON(doc).relationshipDisplay).toEqual({ hideEnds: true, notation: 'numeric' });
    await user.click(screen.getByRole('combobox', { name: 'Labels' }));
    await user.click(await screen.findByRole('option', { name: 'Always' }));
    expect(toJSON(doc).relationshipDisplay).toEqual({
      hideEnds: true,
      notation: 'numeric',
      labels: 'always',
    });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).relationshipDisplay).toEqual({ hideEnds: true, notation: 'numeric' });
    act(() => {
      editor().undo();
      editor().undo();
    });
    expect(toJSON(doc)).not.toHaveProperty('relationshipDisplay');
  });

  it('groups tables by group or by schema in one undo step (048)', async () => {
    const { doc, editor, user } = setupWith(tableDeck);
    const mode = screen.getByRole('radiogroup', { name: 'Group tables' });
    expect(within(mode).getByRole('radio', { name: 'By group' })).toBeChecked();
    await user.click(within(mode).getByRole('radio', { name: 'By schema' }));
    expect(toJSON(doc).groupingMode).toBe('schema');
    expect(within(mode).getByRole('radio', { name: 'By schema' })).toBeChecked();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).not.toHaveProperty('groupingMode');
    await user.click(within(mode).getByRole('radio', { name: 'By schema' }));
    await user.click(within(mode).getByRole('radio', { name: 'By group' }));
    expect(toJSON(doc)).not.toHaveProperty('groupingMode');
  });

  it('is absent with no table and the Database pack off', () => {
    setupWith({ ...inspectorDeck, packs: ['architecture'] });
    expect(screen.queryByRole('list', { name: 'Show on tables' })).not.toBeInTheDocument();
  });
});
