import { readDeck } from '../../model/use-deck-snapshot';
import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeProps } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { deckOf, renderWithEditor } from '../../test/render-canvas';
import type { StickyFlowNode } from '../deck-to-flow';
import { toStickyNodes } from '../deck-to-flow';
import { StickyNode } from './sticky-node';

const deck = deckOf({
  nodes: [{ id: 'svc', type: 'service', title: 'Order Service' }],
  stickies: [
    {
      id: 'st1',
      text: '**Owner**\n\n- retry `<script>`',
      anchor: 'svc',
      position: { x: 10, y: -8 },
    },
    { id: 'st2', text: 'One line only', position: { x: 40, y: 50 }, collapsed: true },
    { id: 'st3', text: '   ', position: { x: 12, y: 16 } },
  ],
});

function stickyProps(
  file: ReturnType<typeof readDeck>,
  stickyId: string,
): NodeProps<StickyFlowNode> {
  const sticky = toStickyNodes(file, { nodes: [], edges: [], stickies: [] }).find(
    (node) => node.data.stickyId === stickyId,
  );
  if (sticky === undefined) throw new Error(`Missing sticky ${stickyId}`);
  return sticky as unknown as NodeProps<StickyFlowNode>;
}

function renderSticky(stickyId: string) {
  const rendered = renderWithEditor(<StickyNode {...stickyProps(deck, stickyId)} />, deck);
  return {
    ...rendered,
    rerenderSticky: (id = stickyId) => {
      rendered.rerender(<StickyNode {...stickyProps(readDeck(rendered.doc), id)} />);
    },
  };
}

describe('StickyNode', () => {
  it('names notes by label, pin state, collapse state and empty text', () => {
    const first = renderSticky('st1');
    expect(
      screen.getByRole('group', { name: 'Note: Owner, pinned to Order Service' }),
    ).toBeInTheDocument();
    first.unmount();

    const second = renderSticky('st2');
    expect(
      screen.getByRole('group', { name: 'Note: One line only, collapsed' }),
    ).toBeInTheDocument();
    second.unmount();

    renderSticky('st3');
    expect(screen.getByRole('group', { name: 'Note: empty' })).toBeInTheDocument();
  });

  it('renders markdown body, escaped scripts, collapsed line and toggle labels', async () => {
    const user = userEvent.setup();
    const { rerenderSticky } = renderSticky('st1');
    expect(screen.getByText('Owner').tagName).toBe('STRONG');
    expect(screen.getByText('<script>').tagName).toBe('CODE');

    await user.click(screen.getByRole('button', { name: 'Collapse note' }));
    rerenderSticky();
    expect(screen.getByRole('button', { name: 'Expand note' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('shows the pinned footer and updates it when the node title changes', () => {
    const { editor, rerenderSticky } = renderSticky('st1');
    expect(screen.getByText('Pinned to Order Service')).toBeInTheDocument();
    act(() => {
      editor().update('nodes', 'svc', { title: 'Payments API' });
    });
    rerenderSticky();
    expect(screen.getByText('Pinned to Payments API')).toBeInTheDocument();
  });

  it('enters edit mode on double-click, Enter or F2, writes live, and leaves on Esc or blur', async () => {
    const user = userEvent.setup();
    const { doc, rerenderSticky } = renderSticky('st1');
    const card = screen.getByRole('group', { name: 'Note: Owner, pinned to Order Service' });

    fireEvent.doubleClick(card);
    const firstBox = await screen.findByRole('textbox', { name: 'Note text' });
    await user.clear(firstBox);
    await user.type(firstBox, 'Updated text');
    expect(readDeck(doc).stickies.find((sticky) => sticky.id === 'st1')?.text).toBe('Updated text');
    fireEvent.blur(firstBox);
    rerenderSticky();
    expect(screen.queryByRole('textbox', { name: 'Note text' })).not.toBeInTheDocument();
    expect(readDeck(doc).stickies.find((sticky) => sticky.id === 'st1')?.text).toBe('Updated text');

    fireEvent.keyDown(card, { key: 'Enter' });
    const secondBox = await screen.findByRole('textbox', { name: 'Note text' });
    await user.clear(secondBox);
    await user.type(secondBox, 'Escaped text');
    await user.keyboard('{Escape}');
    rerenderSticky();
    expect(screen.queryByRole('textbox', { name: 'Note text' })).not.toBeInTheDocument();
    expect(readDeck(doc).stickies.find((sticky) => sticky.id === 'st1')?.text).toBe('Updated text');

    fireEvent.keyDown(card, { key: 'F2' });
    expect(await screen.findByRole('textbox', { name: 'Note text' })).toBeInTheDocument();
  });
});
