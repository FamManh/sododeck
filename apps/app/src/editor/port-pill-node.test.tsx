import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeProps } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, editorWrapper } from '../test/render-canvas';
import type { PortFlowNode } from './deck-to-flow';
import { PortPillNode } from './port-pill-node';

describe('PortPillNode', () => {
  it('goes up one level and selects the outside node', async () => {
    const user = userEvent.setup();
    const deck = deckOf({
      nodes: [
        { id: 'inside', type: 'service', title: 'Inside', group: 'core' },
        { id: 'outside', type: 'service', title: 'Outside' },
      ],
      groups: [{ id: 'core', title: 'Core' }],
      edges: [{ id: 'edge', from: 'inside', to: 'outside' }],
    });
    const props = {
      id: 'port:outside',
      data: { outsideNodeId: 'outside', outsideTitle: 'Outside' },
      width: 120,
      height: 36,
    } as unknown as NodeProps<PortFlowNode>;
    const env = editorWrapper(deck);
    act(() => {
      useUiStore.getState().drillInto({
        kind: 'group',
        id: 'core',
        viewport: { x: 0, y: 0, zoom: 1 },
      });
    });
    render(<PortPillNode {...props} />, { wrapper: env.wrapper });

    await user.click(screen.getByRole('button', { name: 'Go to Outside' }));
    expect(useUiStore.getState().drill).toEqual([]);
    expect(useUiStore.getState().selection.nodes).toEqual(['outside']);
    expect(useUiStore.getState().focusedId).toBe('outside');
  });
});
