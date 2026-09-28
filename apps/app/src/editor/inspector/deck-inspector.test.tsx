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
      editor().add('nodes', { id: 'lonely', type: 'service', title: 'Legacy Invoicer' });
    });
    expect(
      await screen.findByRole('button', { name: /Legacy Invoicer has no connections/ }),
    ).toBeInTheDocument();
    const after = toJSON(doc);
    expect(JSON.stringify(after)).not.toContain('problems');
    expect({ ...after, nodes: before.nodes }).toEqual(before);
  });

  it('selects the component behind a problem row (015 US2)', async () => {
    const { editor, user } = setup();
    act(() => {
      editor().add('nodes', { id: 'lonely', type: 'service', title: 'Legacy Invoicer' });
    });
    await user.click(
      await screen.findByRole('button', { name: /Legacy Invoicer has no connections/ }),
    );
    expect(useUiStore.getState().selection.nodes).toEqual(['lonely']);
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
    expect(toJSON(doc)).toMatchObject({ description: 'Last mile.', tags: ['logistics'] });
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
