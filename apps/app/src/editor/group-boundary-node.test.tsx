import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeProps } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import type { GroupFlowNode } from './deck-to-flow';
import { GroupBoundaryNode } from './group-boundary-node';

describe('GroupBoundaryNode', () => {
  it('labels the boundary with the group title and member count', () => {
    const props = {
      id: 'group:core',
      data: { title: 'Core services', count: 8 },
      width: 300,
      height: 200,
    } as unknown as NodeProps<GroupFlowNode>;
    render(<GroupBoundaryNode {...props} />);
    const boundary = screen.getByRole('button', { name: 'Core services group, 8 nodes' });
    expect(boundary).toHaveAttribute('aria-expanded', 'true');
    expect(boundary).toHaveAttribute('title', 'Double-click or ↵ to open');
    expect(screen.getByTestId('group-boundary')).toHaveTextContent('Core services8');
  });

  it('selects the group on click', async () => {
    const user = userEvent.setup();
    const props = {
      id: 'group:core',
      data: { title: 'Core services', count: 8, focused: false },
      width: 300,
      height: 200,
    } as unknown as NodeProps<GroupFlowNode>;
    renderWithEditor(<GroupBoundaryNode {...props} />, deckOf({}));
    await user.click(screen.getByRole('button', { name: 'Core services group, 8 nodes' }));
    expect(useUiStore.getState().selection.groups).toEqual(['core']);
    expect(useUiStore.getState().focusedId).toBe('group:core');
  });
});
