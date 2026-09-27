import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { fieldDeck } from '../../test/field-fixtures';
import { NodeFieldHarness } from '../../test/field-harness';
import { renderWithEditor } from '../../test/render-canvas';
import { TagsField } from './tags-field';

function setup() {
  const view = renderWithEditor(
    <NodeFieldHarness
      field={(node, deck, write) => (
        <TagsField
          deck={deck}
          value={node.tags}
          onCommit={(tags) => {
            write({ tags });
          }}
        />
      )}
    />,
    fieldDeck,
  );
  return { ...view, user: userEvent.setup() };
}

describe('TagsField (FR-005)', () => {
  it('adds a normalized tag once, announces it, and each add is one undo step', async () => {
    const { user, doc, editor } = setup();
    const add = screen.getByRole('combobox', { name: 'Add tag' });
    await user.type(add, ' PCI {Enter}');
    expect(toJSON(doc).nodes[0]?.tags).toEqual(['pci']);
    await user.type(add, 'Critical{Enter}');
    expect(toJSON(doc).nodes[0]?.tags).toEqual(['pci', 'critical']);
    expect(useUiStore.getState().announcement.text).toBe('critical added');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).nodes[0]?.tags).toEqual(['pci']);
  });

  it('suggests deck tags and removes with × and Backspace, clearing the field when empty', async () => {
    const { user, doc } = setup();
    await user.type(screen.getByRole('combobox', { name: 'Add tag' }), 'pri');
    expect(
      within(screen.getByRole('listbox', { name: 'Tag suggestions' })).getByRole('option', {
        name: 'pricing',
      }),
    ).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(toJSON(doc).nodes[0]?.tags).toEqual(['pci', 'pricing']);
    await user.click(screen.getByRole('button', { name: 'Remove tag pci' }));
    screen.getByRole('combobox', { name: 'Add tag' }).focus();
    await user.keyboard('{Backspace}');
    expect(toJSON(doc).nodes[0]?.tags).toBeUndefined();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Tags' })).toBeInTheDocument();
  });
});
