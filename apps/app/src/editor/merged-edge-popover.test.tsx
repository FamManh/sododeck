import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, editorWrapper } from '../test/render-canvas';
import { MergedEdgePopover } from './merged-edge-popover';

describe('MergedEdgePopover', () => {
  it('lists the merged connections and expands their groups when a row is chosen', async () => {
    const user = userEvent.setup();
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'left' },
        { id: 'b', type: 'service', title: 'B', group: 'right' },
      ],
      groups: [
        { id: 'left', title: 'Left' },
        { id: 'right', title: 'Right' },
      ],
      edges: Array.from({ length: 12 }, (_, index) => ({
        id: `e${String(index)}`,
        from: 'a',
        to: 'b',
        label: `Connection ${String(index + 1)}`,
      })),
    });
    const env = editorWrapper(deck);
    act(() => {
      useUiStore.setState({
        collapsed: new Set(['left', 'right']),
        popover: { kind: 'merged', edgeId: 'merged:collapsed:left|collapsed:right' },
      });
    });
    render(<MergedEdgePopover deck={deck} />, { wrapper: env.wrapper });

    expect(
      screen.getByRole('dialog', { name: 'Connections between Left and Right' }),
    ).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    const [first] = options;
    if (first === undefined) throw new Error('Expected merged connection option');
    expect(options).toHaveLength(12);
    expect(first).toHaveTextContent('Connection 1');
    await user.click(first);
    expect(useUiStore.getState().collapsed.size).toBe(0);
    expect(useUiStore.getState().selection.edges).toEqual(['e0']);
  });
});
