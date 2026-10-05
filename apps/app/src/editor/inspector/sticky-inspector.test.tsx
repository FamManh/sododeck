import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { InspectorView } from '../../test/inspector-view';
import { useUiStore } from '../../state/ui-store';

const stickyDeck = deckOf({
  nodes: [
    { id: 'svc', type: 'service', title: 'Order Service', position: { x: 120, y: 180 } },
    { id: 'pay', type: 'service', title: 'Payment Service', position: { x: 420, y: 220 } },
  ],
  edges: [{ id: 'edge-1', from: 'svc', to: 'pay' }],
  flows: [{ id: 'flow-1', title: 'Place order', steps: [{ id: 'step-1', edge: 'edge-1' }] }],
  stickies: [
    { id: 'free', text: '', position: { x: 48, y: 72 } },
    { id: 'note', text: 'A note', position: { x: 156, y: 140 } },
    { id: 'tagged', text: 'Tagged', position: { x: 9, y: 9 }, tags: ['pci'] },
  ],
});

function sticky(id: string, doc: Parameters<typeof toJSON>[0]) {
  const found = toJSON(doc).stickies.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`Missing sticky ${id}`);
  return found;
}

function setup(stickyId: string, readOnly = false) {
  const user = userEvent.setup();
  const view = renderWithEditor(
    <>
      <InspectorView />
      {readOnly ? <div role="alertdialog" aria-label="Read only" /> : null}
    </>,
    stickyDeck,
  );
  act(() => {
    useUiStore.getState().select({ stickies: [stickyId] });
  });
  return { ...view, user };
}

describe('StickyInspector', () => {
  it('shows the header, markdown modes, and empty preview text', async () => {
    const { user } = setup('free');

    expect(screen.getByRole('heading', { name: 'Note' })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Preview' }));
    const preview = screen.getByRole('region', { name: 'Note text preview' });
    expect(preview).toHaveTextContent('Nothing to preview.');
  });

  it('has no pin controls: notes are always free (ADR 0041)', () => {
    setup('note');
    expect(screen.queryByText('Anchor')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Pinned to node' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unpin' })).not.toBeInTheDocument();
  });

  it('updates display and flow visibility, and requests note deletion', async () => {
    const { user, doc } = setup('note');

    await user.click(screen.getByRole('radio', { name: 'Collapsed' }));
    expect(sticky('note', doc).collapsed).toBe(true);
    expect(useUiStore.getState().announcement.text).toBe('Note collapsed');
    await user.click(screen.getByRole('radio', { name: 'Expanded' }));
    expect(sticky('note', doc).collapsed).toBeUndefined();
    expect(useUiStore.getState().announcement.text).toBe('Note expanded');

    const visible = screen.getByRole('switch', { name: 'Stay visible during flows' });
    await user.click(visible);
    expect(sticky('note', doc).showInFlows).toBe(true);
    await user.click(visible);
    expect(sticky('note', doc).showInFlows).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(useUiStore.getState().pendingDelete).toEqual({
      targets: [{ scope: 'stickies', id: 'note' }],
    });
  });

  it('disables every field in a read-only deck', () => {
    setup('note', true);

    expect(screen.getByRole('radio', { name: 'Write' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Preview' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Expanded' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Collapsed' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Stay visible during flows' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete note' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Note text' })).toBeDisabled();
  });
});

describe('StickyInspector format rows (053 US2)', () => {
  it('shows the default size, and writes a typed size in one undo step', async () => {
    const { user, doc, editor } = setup('note');
    const width = screen.getByRole('spinbutton', { name: 'Width' });
    expect(width).toHaveValue(200);
    expect(screen.getByRole('spinbutton', { name: 'Height' })).toHaveValue(200);
    expect(screen.getByRole('button', { name: 'Reset size' })).toBeDisabled();

    await user.clear(width);
    await user.type(width, '320{Enter}');
    expect(sticky('note', doc).size).toEqual({ width: 320, height: 200 });
    expect(screen.getByRole('button', { name: 'Reset size' })).toBeEnabled();

    await user.clear(width);
    await user.type(width, '20{Enter}');
    // Clamped to the 96 px minimum, like a handle drag.
    expect(sticky('note', doc).size).toEqual({ width: 96, height: 200 });

    act(() => {
      editor().undo();
    });
    expect(sticky('note', doc).size).toEqual({ width: 320, height: 200 });
    await user.click(screen.getByRole('button', { name: 'Reset size' }));
    expect(sticky('note', doc).size).toBeUndefined();
  });

  it('sets a fixed text size or Auto, one undo step each', async () => {
    const { user, doc, editor } = setup('note');
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked();
    for (const label of ['Auto', '12', '14', '16', '20', '24', '32']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
    await user.click(screen.getByRole('radio', { name: '24' }));
    expect(sticky('note', doc).fontSize).toBe(24);
    expect(useUiStore.getState().announcement.text).toBe('Text size 24');
    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(sticky('note', doc).fontSize).toBeUndefined();
    act(() => {
      editor().undo();
    });
    expect(sticky('note', doc).fontSize).toBe(24);
  });

  it('aligns the text, and never stores the default', async () => {
    const { user, doc, editor } = setup('note');
    expect(screen.getByRole('radio', { name: 'Align centre' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Align right' }));
    expect(sticky('note', doc).align).toBe('right');
    await user.click(screen.getByRole('radio', { name: 'Align centre' }));
    expect(sticky('note', doc).align).toBeUndefined();
    act(() => {
      editor().undo();
    });
    expect(sticky('note', doc).align).toBe('right');
  });

  it('locks and unlocks, and a locked note cannot be resized from here', async () => {
    const { user, doc, editor } = setup('note');
    const lock = screen.getByRole('switch', { name: 'Lock' });
    expect(lock).not.toBeChecked();
    await user.click(lock);
    expect(sticky('note', doc).locked).toBe(true);
    expect(useUiStore.getState().announcement.text).toBe('Note locked');
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset size' })).toBeDisabled();
    await user.click(lock);
    expect(sticky('note', doc).locked).toBeUndefined();
    act(() => {
      editor().undo();
    });
    expect(sticky('note', doc).locked).toBe(true);
  });

  it('disables the format rows in a read-only deck', () => {
    setup('note', true);
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '24' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Align left' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Lock' })).toBeDisabled();
  });

  it('shows the tags of a note, adds one from the shared picker and removes one (053)', async () => {
    const { user, doc, editor } = setup('tagged');
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(within(list).getByText('pci')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add tag' }));
    await user.type(await screen.findByRole('searchbox', { name: 'Filter tags' }), 'edge{Enter}');
    expect(sticky('tagged', doc).tags).toEqual(['pci', 'edge']);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Remove tag pci' }));
    expect(sticky('tagged', doc).tags).toEqual(['edge']);
    act(() => {
      editor().undo();
    });
    expect(sticky('tagged', doc).tags).toEqual(['pci', 'edge']);
  });
});
