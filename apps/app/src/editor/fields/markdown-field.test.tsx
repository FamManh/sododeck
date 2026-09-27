import { toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { fieldDeck } from '../../test/field-fixtures';
import { NodeFieldHarness } from '../../test/field-harness';
import { renderWithEditor } from '../../test/render-canvas';
import { MarkdownField } from './markdown-field';

function setup() {
  const view = renderWithEditor(
    <NodeFieldHarness
      field={(node, _deck, write) => (
        <MarkdownField
          modeKey={`nodes:${node.id}`}
          value={node.description ?? ''}
          onCommit={(description) => {
            write({ description: description === '' ? null : description });
          }}
        />
      )}
    />,
    fieldDeck,
  );
  return { ...view, user: userEvent.setup() };
}

describe('MarkdownField (FR-003)', () => {
  it('writes in Write, previews bullets and code, and keeps the mode in the UI store', async () => {
    const { user, doc } = setup();
    const view = screen.getByRole('radiogroup', { name: 'Description view' });
    expect(screen.getByRole('radio', { name: 'Write' })).toBeChecked();
    const text = screen.getByRole('textbox', { name: 'Description' });
    await user.type(text, 'Returns a fee.{Enter}{Enter}- uses `Delivery tier`');
    await user.tab();
    expect(toJSON(doc).nodes[0]?.description).toBe('Returns a fee.\n\n- uses `Delivery tier`');
    await user.click(screen.getByRole('radio', { name: 'Preview' }));
    const preview = screen.getByRole('region', { name: 'Description preview' });
    expect(preview.querySelector('li code')).toHaveTextContent('Delivery tier');
    expect(useUiStore.getState().descriptionMode).toEqual({ 'nodes:p': 'preview' });
    expect(view).toBeInTheDocument();
  });

  it('shows HTML as text and "Nothing to preview." when empty', async () => {
    const { user, editor } = setup();
    await user.click(screen.getByRole('radio', { name: 'Preview' }));
    expect(screen.getByText('Nothing to preview.')).toBeInTheDocument();
    act(() => {
      editor().update('nodes', 'p', { description: '<b>x</b><script>1</script>' });
    });
    const preview = screen.getByRole('region', { name: 'Description preview' });
    expect(preview.querySelector('b, script')).toBeNull();
    expect(preview).toHaveTextContent('<b>x</b><script>1</script>');
  });
});
