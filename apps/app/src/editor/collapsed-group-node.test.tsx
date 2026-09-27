import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeProps } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import type { CollapsedFlowNode } from './deck-to-flow';
import { CollapsedGroupNode } from './collapsed-group-node';

describe('CollapsedGroupNode', () => {
  function props() {
    return {
      id: 'collapsed:core',
      data: { groupId: 'core', title: 'Core services', nodeCount: 8, edgeCount: 12, focused: true },
      selected: false,
      width: 180,
      height: 64,
    } as unknown as NodeProps<CollapsedFlowNode>;
  }

  it('renders a button with its counts', () => {
    renderWithEditor(<CollapsedGroupNode {...props()} />, deckOf({}));
    expect(
      screen.getByRole('button', {
        name: 'Core services, collapsed group, 8 nodes, 12 edges',
      }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('8 nodes · 12 edges')).toBeInTheDocument();
  });

  it('selects the group on click', async () => {
    const user = userEvent.setup();
    renderWithEditor(<CollapsedGroupNode {...props()} />, deckOf({}));
    await user.click(
      screen.getByRole('button', {
        name: 'Core services, collapsed group, 8 nodes, 12 edges',
      }),
    );
    expect(useUiStore.getState().selection.groups).toEqual(['core']);
    expect(useUiStore.getState().focusedId).toBe('collapsed:core');
  });
});
