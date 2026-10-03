import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

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
