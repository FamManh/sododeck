import { stickyCanvasPosition, toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
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
    { id: 'pinned', text: 'Pinned note', anchor: 'svc', position: { x: 36, y: -40 } },
    { id: 'foreign', text: 'Foreign note', anchor: 'edge-1', position: { x: 80, y: 96 } },
    { id: 'missing', text: 'Missing note', anchor: 'gone', position: { x: 16, y: 20 } },
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
  it('shows the header, subtitle, markdown modes, and empty preview text', async () => {
    const { user } = setup('free');

    expect(screen.getByRole('heading', { name: 'Note' })).toBeInTheDocument();
    expect(screen.getByText('Note · free')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Preview' }));
    const preview = screen.getByRole('region', { name: 'Note text preview' });
    expect(preview).toHaveTextContent('Nothing to preview.');
  });

  it('pins and unpins while keeping the same canvas point', async () => {
    const { doc, user } = setup('free');

    const before = stickyCanvasPosition(toJSON(doc), sticky('free', doc)).point;
    await user.click(screen.getByRole('radio', { name: 'Pinned to node' }));
    const pinnedTo = screen.getByRole('combobox', { name: 'Pinned to' });
    await user.click(pinnedTo);
    await user.type(pinnedTo, 'Order');
    await user.keyboard('{ArrowDown}{Enter}');

    const pinned = sticky('free', doc);
    expect(pinned.anchor).toBe('svc');
    expect(stickyCanvasPosition(toJSON(doc), pinned).point).toEqual(before);
    expect(screen.getByText('Note · pinned to Order Service')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Free' }));
    const freed = sticky('free', doc);
    expect(freed.anchor).toBeUndefined();
    expect(stickyCanvasPosition(toJSON(doc), freed).point).toEqual(before);
  });

  it('shows foreign and missing anchors as read-only, with Unpin', async () => {
    const foreign = setup('foreign');
    expect(
      screen.getByText('Pinned to connection Order Service → Payment Service'),
    ).toBeInTheDocument();
    await foreign.user.click(screen.getByRole('button', { name: 'Unpin' }));
    expect(sticky('foreign', foreign.doc).anchor).toBeUndefined();
    foreign.unmount();

    const missing = setup('missing');
    expect(screen.getByText('Pinned object is missing')).toBeInTheDocument();
    await missing.user.click(screen.getByRole('button', { name: 'Unpin' }));
    expect(sticky('missing', missing.doc).anchor).toBeUndefined();
  });

  it('updates display and flow visibility, and requests note deletion', async () => {
    const { user, doc } = setup('pinned');

    await user.click(screen.getByRole('radio', { name: 'Collapsed' }));
    expect(sticky('pinned', doc).collapsed).toBe(true);
    await user.click(screen.getByRole('radio', { name: 'Expanded' }));
    expect(sticky('pinned', doc).collapsed).toBeUndefined();

    const visible = screen.getByRole('switch', { name: 'Stay visible during flows' });
    await user.click(visible);
    expect(sticky('pinned', doc).showInFlows).toBe(true);
    await user.click(visible);
    expect(sticky('pinned', doc).showInFlows).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(useUiStore.getState().pendingDelete).toEqual({
      targets: [{ scope: 'stickies', id: 'pinned' }],
    });
  });

  it('disables every field in a read-only deck', () => {
    setup('pinned', true);

    expect(screen.getByRole('radio', { name: 'Write' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Preview' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Free' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Pinned to node' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Pinned to' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Expanded' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Collapsed' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Stay visible during flows' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete note' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Note text' })).toBeDisabled();
  });
});
