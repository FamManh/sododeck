import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { TagPicker } from './tag-picker';

const deck = deckOf({
  tagColors: { PCI: 'violet' },
  nodes: [
    { id: 'a', type: 'service', title: 'A', tags: ['PCI', 'lan'] },
    { id: 'b', type: 'service', title: 'B', tags: ['pci', 'edge'] },
    { id: 'c', type: 'service', title: 'C' },
  ],
});

const optionNames = () =>
  within(screen.getByRole('listbox', { name: 'Deck tags' }))
    .getAllByRole('option')
    .map((option) => option.textContent);

describe('TagPicker: list (033)', () => {
  it('lists deck tags most used first with their count and a colour', () => {
    renderWithEditor(<TagPicker nodeIds={['c']} />, deck);
    expect(screen.getByRole('searchbox', { name: 'Filter tags' })).toBeInTheDocument();
    expect(optionNames()).toEqual(['PCI2', 'edge1', 'lan1']);
    const pci = screen.getByRole('option', { name: /PCI/ });
    expect(pci.querySelector('[data-slot="tag-dot"]')).toHaveStyle({
      '--tag-dot': 'var(--color-card-violet-dot)',
    });
    const edge = screen.getByRole('option', { name: /edge/ });
    expect(edge.querySelector('[data-slot="tag-dot"]')).toHaveStyle({
      '--tag-dot': 'var(--color-card-slate-dot)',
    });
  });

  it('filters by key, ignoring case', async () => {
    const user = userEvent.setup();
    renderWithEditor(<TagPicker nodeIds={['c']} />, deck);
    await user.type(screen.getByRole('searchbox', { name: 'Filter tags' }), 'PC');
    // "PC" is not a tag itself, so it is offered as a new one under the match.
    expect(optionNames()).toEqual(['PCI2', 'Create tag “PC”']);
  });

  it('opens the editor from the pencil and returns with "Back to tags"', async () => {
    const user = userEvent.setup();
    renderWithEditor(<TagPicker nodeIds={['c']} />, deck);
    await user.click(screen.getByRole('button', { name: 'Edit tag PCI' }));
    expect(screen.getByRole('radiogroup', { name: 'Tag colour' })).toBeInTheDocument();
    expect(screen.queryByRole('listbox', { name: 'Deck tags' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to tags' }));
    expect(screen.getByRole('listbox', { name: 'Deck tags' })).toBeInTheDocument();
  });

  it('lists a coloured tag with no card, with a count of 0', () => {
    renderWithEditor(<TagPicker nodeIds={['c']} />, { ...deck, tagColors: { Orphan: 'red' } });
    expect(optionNames()).toContain('Orphan0');
  });

  it('writes nothing just by opening', () => {
    const { doc } = renderWithEditor(<TagPicker nodeIds={['c']} />, deck);
    expect(toJSON(doc)).toEqual(deck);
  });
});

const tagsOf = (doc: Parameters<typeof toJSON>[0], id: string) =>
  toJSON(doc).nodes.find((n) => n.id === id)?.tags;

describe('TagPicker: choose and create (033)', () => {
  const search = () => screen.getByRole('searchbox', { name: 'Filter tags' });

  it('shows on-all rows checked and on-some rows as "n of N"', () => {
    const some = renderWithEditor(<TagPicker nodeIds={['a', 'b', 'c']} />, deck);
    expect(screen.getByRole('option', { name: /PCI/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('option', { name: /PCI/ })).toHaveTextContent('2 of 3');
    some.unmount();
    renderWithEditor(<TagPicker nodeIds={['a']} />, deck);
    expect(screen.getByRole('option', { name: /lan/ })).toHaveAttribute('aria-selected', 'true');
  });

  it("adds a tag with Enter, in the row's spelling, and removes it with Enter again", async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<TagPicker nodeIds={['c']} />, deck);
    await user.type(search(), 'pci{Enter}');
    expect(tagsOf(doc, 'c')).toEqual(['PCI']);
    await user.keyboard('{Enter}');
    expect(tagsOf(doc, 'c')).toBeUndefined();
  });

  it('moves with the arrow keys and toggles a row by click', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<TagPicker nodeIds={['c']} />, deck);
    await user.click(search());
    await user.keyboard('{ArrowDown}{Enter}');
    expect(tagsOf(doc, 'c')).toEqual(['edge']);
    await user.click(screen.getByRole('option', { name: /lan/ }));
    expect(tagsOf(doc, 'c')).toEqual(['edge', 'lan']);
  });

  it('offers "Create tag" for text that is not a tag, and adds it as typed with no colour', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<TagPicker nodeIds={['c']} />, deck);
    await user.type(search(), 'PIC');
    await user.click(screen.getByRole('option', { name: 'Create tag “PIC”' }));
    expect(tagsOf(doc, 'c')).toEqual(['PIC']);
    expect(toJSON(doc).tagColors).toEqual({ PCI: 'violet' });
  });

  it('does not offer "Create tag" for an exact match by key', async () => {
    const user = userEvent.setup();
    renderWithEditor(<TagPicker nodeIds={['c']} />, deck);
    await user.type(search(), ' LAN ');
    expect(screen.queryByRole('option', { name: /Create tag/ })).not.toBeInTheDocument();
  });

  it('creating "pic" next to an existing "PIC" resolves to "PIC"', async () => {
    const user = userEvent.setup();
    const file = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', tags: ['PIC'] },
        { id: 'b', type: 'service', title: 'B' },
      ],
    });
    const { doc } = renderWithEditor(<TagPicker nodeIds={['b']} />, file);
    await user.type(search(), 'pic{Enter}');
    expect(tagsOf(doc, 'b')).toEqual(['PIC']);
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('adds one undo step per toggle across the selection', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(<TagPicker nodeIds={['a', 'b', 'c']} />, deck);
    await user.type(search(), 'edge{Enter}');
    expect([tagsOf(doc, 'a'), tagsOf(doc, 'b'), tagsOf(doc, 'c')]).toEqual([
      ['PCI', 'lan', 'edge'],
      ['pci', 'edge'],
      ['edge'],
    ]);
    act(() => {
      editor().undo();
    });
    expect(tagsOf(doc, 'a')).toEqual(['PCI', 'lan']);
    expect(tagsOf(doc, 'c')).toBeUndefined();
  });

  it('refuses an eleventh tag with "10 tags max" and writes nothing', async () => {
    const user = userEvent.setup();
    const ten = Array.from({ length: 10 }, (_, i) => `t${String(i)}`);
    const file = deckOf({ nodes: [{ id: 'a', type: 'service', title: 'A', tags: ten }] });
    const { doc } = renderWithEditor(<TagPicker nodeIds={['a']} />, { ...file });
    await user.type(search(), 'extra{Enter}');
    expect(screen.getByText('10 tags max')).toBeInTheDocument();
    expect(tagsOf(doc, 'a')).toEqual(ten);
  });

  it('announces additions and removals', async () => {
    const user = userEvent.setup();
    renderWithEditor(<TagPicker nodeIds={['c']} />, deck);
    await user.type(search(), 'edge{Enter}');
    expect(useUiStore.getState().announcement.text).toBe('edge added');
    await user.keyboard('{Enter}');
    expect(useUiStore.getState().announcement.text).toBe('edge removed');
  });
});
