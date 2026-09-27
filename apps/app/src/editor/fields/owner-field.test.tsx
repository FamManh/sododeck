import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fieldDeck } from '../../test/field-fixtures';
import { NodeFieldHarness } from '../../test/field-harness';
import { renderWithEditor } from '../../test/render-canvas';
import { OwnerField } from './owner-field';

describe('OwnerField (FR-004)', () => {
  it('suggests deck owners containing the text and accepts a new owner as is', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(
      <NodeFieldHarness
        field={(node, deck, write) => (
          <OwnerField
            deck={deck}
            value={node.owner ?? ''}
            onCommit={(owner) => {
              write({ owner: owner === '' ? null : owner });
            }}
          />
        )}
      />,
      fieldDeck,
    );
    const owner = screen.getByRole('combobox', { name: 'Owner' });
    expect(owner).toHaveAttribute('placeholder', 'Add owner');
    await user.clear(owner);
    await user.type(owner, 'or');
    const names = within(screen.getByRole('listbox', { name: 'Owner suggestions' }))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(names).toEqual(expect.arrayContaining(['Core', 'Order desk']));
    await user.clear(owner);
    await user.type(owner, 'Platform{Enter}');
    expect(toJSON(doc).nodes[0]?.owner).toBe('Platform');
    await user.tab();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).nodes[0]?.owner).toBe('Orders');
  });
});
