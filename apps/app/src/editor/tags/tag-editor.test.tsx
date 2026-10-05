import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { TagEditor } from './tag-editor';

const deck = deckOf({
  swatches: ['#7a3cff'],
  tagColors: { PCI: 'violet' },
  nodes: [
    { id: 'a', type: 'service', title: 'A', tags: ['PCI', 'lan'] },
    { id: 'b', type: 'service', title: 'B', tags: ['pci'] },
  ],
});

describe('TagEditor: colour (033)', () => {
  it('offers the 13 colours, the deck colours and "No colour", with the current one checked', () => {
    renderWithEditor(<TagEditor tag="PCI" onBack={() => undefined} />, deck);
    const group = screen.getByRole('radiogroup', { name: 'Tag colour' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual([
      ...[
        'Red',
        'Orange',
        'Amber',
        'Yellow',
        'Lime',
        'Green',
        'Teal',
        'Cyan',
        'Blue',
        'Indigo',
        'Violet',
        'Pink',
        'Slate',
      ],
      'No colour',
      '#7a3cff',
    ]);
    expect(within(group).getByRole('radio', { name: 'Violet' })).toBeChecked();
  });

  it('applies a colour at once, as one undo step', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(
      <TagEditor tag="lan" onBack={() => undefined} />,
      deck,
    );
    expect(screen.getByRole('radio', { name: 'No colour' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Green' }));
    expect(toJSON(doc).tagColors).toEqual({ lan: 'green', PCI: 'violet' });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).tagColors).toEqual({ PCI: 'violet' });
  });

  it('applies a deck colour and clears with "No colour"', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<TagEditor tag="PCI" onBack={() => undefined} />, deck);
    await user.click(screen.getByRole('radio', { name: '#7a3cff' }));
    expect(toJSON(doc).tagColors).toEqual({ PCI: '#7a3cff' });
    await user.click(screen.getByRole('radio', { name: 'No colour' }));
    expect(toJSON(doc)).not.toHaveProperty('tagColors');
  });

  it('goes back with the Back button and with Escape', async () => {
    const user = userEvent.setup();
    let backs = 0;
    renderWithEditor(
      <TagEditor
        tag="PCI"
        onBack={() => {
          backs += 1;
        }}
      />,
      deck,
    );
    await user.click(screen.getByRole('button', { name: 'Back to tags' }));
    expect(backs).toBe(1);
    screen.getByRole('radio', { name: 'Violet' }).focus();
    await user.keyboard('{Escape}');
    expect(backs).toBe(2);
  });
});

const wide = deckOf({
  tagColors: { PCI: 'violet' },
  tags: ['PCI'],
  nodes: [
    { id: 'a', type: 'service', title: 'A', tags: ['PCI', 'lan'] },
    { id: 'b', type: 'service', title: 'B', tags: ['pci'] },
    { id: 'c', type: 'service', title: 'C', tags: ['PCI', 'PIC'] },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b', tags: ['pci'] },
    { id: 'e2', from: 'a', to: 'c', tags: ['PCI'] },
  ],
  flows: [{ id: 'f', title: 'F', tags: ['pci'], steps: [] }],
});

function renderEditor(file = wide, tag = 'PCI') {
  const calls = { back: 0, renamed: [] as string[], deleted: 0 };
  const view = renderWithEditor(
    <TagEditor
      tag={tag}
      onBack={() => {
        calls.back += 1;
      }}
      onRenamed={(next) => {
        calls.renamed.push(next);
      }}
      onDeleted={() => {
        calls.deleted += 1;
      }}
    />,
    file,
  );
  return { ...view, calls, user: userEvent.setup() };
}

describe('TagEditor: rename (033)', () => {
  it('renames on Enter, everywhere, and announces it', async () => {
    const { user, doc, calls } = renderEditor();
    const name = screen.getByRole('textbox', { name: 'Tag name' });
    expect(name).toHaveValue('PCI');
    await user.clear(name);
    await user.type(name, 'PCI-DSS{Enter}');
    const file = toJSON(doc);
    expect(file.nodes.map((n) => n.tags)).toEqual([
      ['PCI-DSS', 'lan'],
      ['PCI-DSS'],
      ['PCI-DSS', 'PIC'],
    ]);
    expect(file.edges.map((e) => e.tags)).toEqual([['PCI-DSS'], ['PCI-DSS']]);
    expect(file.tagColors).toEqual({ 'PCI-DSS': 'violet' });
    expect(calls.renamed).toEqual(['PCI-DSS']);
    expect(useUiStore.getState().announcement.text).toBe('PCI renamed to PCI-DSS');
  });

  it('refuses an empty name with a message and writes nothing', async () => {
    const { user, doc } = renderEditor();
    const before = toJSON(doc);
    const name = screen.getByRole('textbox', { name: 'Tag name' });
    await user.clear(name);
    await user.type(name, '   {Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('A tag needs a name');
    expect(toJSON(doc)).toEqual(before);
  });

  it('does nothing when the name is unchanged', async () => {
    const { user, doc, editor } = renderEditor();
    await user.type(screen.getByRole('textbox', { name: 'Tag name' }), '{Enter}');
    expect(editor().canUndo()).toBe(false);
    expect(toJSON(doc)).toEqual(wide);
  });

  it('asks before merging into another tag, and only Merge writes', async () => {
    const { user, doc, calls } = renderEditor();
    const name = screen.getByRole('textbox', { name: 'Tag name' });
    await user.clear(name);
    await user.type(name, 'pic{Enter}');
    expect(screen.getByText('Merge into “PIC”? 3 cards change')).toBeInTheDocument();
    expect(toJSON(doc)).toEqual(wide);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(toJSON(doc)).toEqual(wide);
    await user.type(name, '{Enter}');
    await user.click(screen.getByRole('button', { name: 'Merge' }));
    const file = toJSON(doc);
    expect(file.nodes.map((n) => n.tags)).toEqual([['PIC', 'lan'], ['PIC'], ['PIC']]);
    expect(file.tagColors).toBeUndefined();
    expect(calls.renamed).toEqual(['PIC']);
    expect(useUiStore.getState().announcement.text).toBe('PCI merged into PIC');
  });
});

describe('TagEditor: delete (033)', () => {
  it('shows the card count and the other carriers, asks to confirm, then deletes in one undo step', async () => {
    const { user, doc, editor, calls } = renderEditor();
    const button = screen.getByRole('button', { name: 'Delete tag · used on 3 cards' });
    expect(screen.getByText('Also on 2 connections, 1 flow and the deck')).toBeInTheDocument();
    await user.click(button);
    expect(toJSON(doc)).toEqual(wide);
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
    const file = toJSON(doc);
    expect(file.nodes.map((n) => n.tags)).toEqual([['lan'], undefined, ['PIC']]);
    expect(file.tags).toBeUndefined();
    expect(file.tagColors).toBeUndefined();
    expect(calls.deleted).toBe(1);
    expect(useUiStore.getState().announcement.text).toBe('PCI deleted, removed from 3 cards');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(wide);
  });

  it('cancels the confirmation without writing', async () => {
    const { user, doc } = renderEditor();
    await user.click(screen.getByRole('button', { name: 'Delete tag · used on 3 cards' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(toJSON(doc)).toEqual(wide);
    expect(
      screen.getByRole('button', { name: 'Delete tag · used on 3 cards' }),
    ).toBeInTheDocument();
  });

  it('uses the singular for one card and skips the second line when only cards carry it', () => {
    renderEditor(wide, 'lan');
    expect(screen.getByRole('button', { name: 'Delete tag · used on 1 card' })).toBeInTheDocument();
    expect(screen.queryByText(/^Also on/)).not.toBeInTheDocument();
  });
});

describe('TagEditor: notes (053)', () => {
  const withNotes = deckOf({
    nodes: [{ id: 'a', type: 'service', title: 'A', tags: ['lan'] }],
    stickies: [
      { id: 'n1', text: 'one', position: { x: 0, y: 0 }, tags: ['LAN'] },
      { id: 'n2', text: 'two', position: { x: 0, y: 0 }, tags: ['lan'] },
    ],
  });

  it('says how many cards and notes use the tag', () => {
    renderWithEditor(<TagEditor tag="lan" onBack={() => undefined} />, withNotes);
    expect(
      screen.getByRole('button', { name: 'Delete tag · used on 1 card and 2 notes' }),
    ).toBeInTheDocument();
  });

  it('deletes the tag from notes too, in one undo step', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(
      <TagEditor tag="lan" onBack={() => undefined} />,
      withNotes,
    );
    await user.click(screen.getByRole('button', { name: /Delete tag/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(toJSON(doc).stickies.map((s) => s.tags)).toEqual([undefined, undefined]);
    expect(useUiStore.getState().announcement.text).toBe(
      'lan deleted, removed from 1 card and 2 notes',
    );
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).stickies.map((s) => s.tags)).toEqual([['LAN'], ['lan']]);
  });

  it('renames across notes', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<TagEditor tag="lan" onBack={() => undefined} />, withNotes);
    const name = screen.getByRole('textbox', { name: 'Tag name' });
    await user.clear(name);
    await user.type(name, 'net{Enter}');
    expect(toJSON(doc).stickies.map((s) => s.tags)).toEqual([['net'], ['net']]);
  });
});
