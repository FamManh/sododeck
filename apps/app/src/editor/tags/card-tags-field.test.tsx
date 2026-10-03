import { toJSON } from '@sododeck/model';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { CardTagsField } from './card-tags-field';

const deck = deckOf({
  tagColors: { PCI: 'violet' },
  nodes: [{ id: 'a', type: 'service', title: 'A', tags: ['PCI', 'plain'] }],
});

function renderField() {
  return renderWithEditor(
    <CardTagsField nodeId="a" tags={['PCI', 'plain']} onCommit={() => undefined} />,
    deck,
  );
}

describe('CardTagsField (033)', () => {
  it('lists the card tags as 21 px pills in their own colours, with a remove button each', () => {
    renderField();
    const list = screen.getByRole('list', { name: 'Tags' });
    const [pci, plain] = within(list).getAllByRole('listitem');
    expect(pci).toHaveTextContent('PCI');
    const chip = pci?.querySelector('[data-slot="tag-chip"]');
    expect(chip).toHaveClass('h-[21px]');
    expect(chip).toHaveStyle({ '--tag-chip': 'var(--color-card-violet-chip)' });
    expect(plain?.querySelector('[data-slot="tag-chip"]')).toHaveStyle({
      '--tag-chip': 'var(--color-card-slate-chip)',
    });
    expect(screen.getByRole('button', { name: 'Remove tag PCI' })).toBeInTheDocument();
  });

  it('opens the picker from "Add tag", in a dialog named "Tags"', async () => {
    const user = userEvent.setup();
    renderField();
    await user.click(screen.getByRole('button', { name: 'Add tag' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tags' });
    expect(within(dialog).getByRole('searchbox', { name: 'Filter tags' })).toHaveFocus();
    expect(within(dialog).getByRole('listbox', { name: 'Deck tags' })).toBeInTheDocument();
  });

  it('writes nothing on its own', () => {
    const { doc } = renderField();
    expect(toJSON(doc)).toEqual(deck);
  });
});

describe('CardTagsField: keyboard (033)', () => {
  it('removes a tag with Backspace and moves focus to the next pill, else to "Add tag"', async () => {
    const user = userEvent.setup();
    const commits: (string[] | null)[] = [];
    renderWithEditor(
      <CardTagsField
        nodeId="a"
        tags={['one', 'two']}
        onCommit={(next) => {
          commits.push(next);
        }}
      />,
      deck,
    );
    screen.getByRole('button', { name: 'Remove tag one' }).focus();
    await user.keyboard('{Backspace}');
    expect(commits).toEqual([['two']]);
    await Promise.resolve();
    expect(screen.getByRole('button', { name: 'Remove tag two' })).toHaveFocus();
    await user.keyboard('{Backspace}');
    await Promise.resolve();
    expect(commits.at(-1)).toEqual(['one']);
    expect(screen.getByRole('button', { name: 'Add tag' })).toHaveFocus();
  });

  it('opens the picker with Enter and Space on "Add tag"', async () => {
    const user = userEvent.setup();
    renderField();
    screen.getByRole('button', { name: 'Add tag' }).focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Tags' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    screen.getByRole('button', { name: 'Add tag' }).focus();
    await user.keyboard(' ');
    expect(await screen.findByRole('dialog', { name: 'Tags' })).toBeInTheDocument();
  });

  it('announces a removal', async () => {
    const user = userEvent.setup();
    renderField();
    await user.click(screen.getByRole('button', { name: 'Remove tag PCI' }));
    expect(useUiStore.getState().announcement.text).toBe('PCI removed');
  });

  it('replaces "Add tag" with a "10 tags max" note at ten tags', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `t${String(i)}`);
    renderWithEditor(<CardTagsField nodeId="a" tags={ten} onCommit={() => undefined} />, deck);
    expect(screen.queryByRole('button', { name: 'Add tag' })).not.toBeInTheDocument();
    expect(screen.getByText('10 tags max')).toBeInTheDocument();
  });

  it('Escape in the editor goes back to the list, a second Escape closes the popover', async () => {
    const user = userEvent.setup();
    renderField();
    await user.click(screen.getByRole('button', { name: 'Add tag' }));
    await user.click(await screen.findByRole('button', { name: 'Edit tag PCI' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('listbox', { name: 'Deck tags' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Tags' })).not.toBeInTheDocument();
  });
});
