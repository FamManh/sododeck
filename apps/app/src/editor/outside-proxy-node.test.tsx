import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeProps } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, editorWrapper } from '../test/render-canvas';
import type { PortFlowNode } from './deck-to-flow';
import { OutsideProxyNode } from './outside-proxy-node';

const deck = deckOf({
  nodes: [
    { id: 'inside', type: 'service', title: 'Inside', group: 'core' },
    { id: 'outside', type: 'database', title: 'Orders DB' },
    { id: 'deep', type: 'service', title: 'Deep', group: 'other' },
  ],
  groups: [
    { id: 'core', title: 'Core' },
    { id: 'other', title: 'Other' },
  ],
  edges: [{ id: 'edge', from: 'inside', to: 'outside' }],
});

function setup(outsideNodeId = 'outside', title = 'Orders DB', kind = 'database') {
  const props = {
    id: `port:${outsideNodeId}`,
    data: { outsideNodeId, outsideTitle: title, kind, side: 'right' },
    width: 150,
    height: 52,
  } as unknown as NodeProps<PortFlowNode>;
  const env = editorWrapper(deck);
  act(() => {
    useUiStore
      .getState()
      .drillInto({ kind: 'group', id: 'core', viewport: { x: 0, y: 0, zoom: 1 } });
  });
  render(<OutsideProxyNode {...props} />, { wrapper: env.wrapper });
  return {
    proxy: screen.getByRole('button', { name: `${title}, outside, press Enter to go to it` }),
  };
}

const ui = () => useUiStore.getState();

describe('OutsideProxyNode (034 US3)', () => {
  it('is a button with a name, showing the title and Outside', () => {
    const { proxy } = setup();
    expect(proxy).toHaveTextContent('Orders DB');
    expect(proxy).toHaveTextContent('Outside');
    expect(proxy).toHaveAttribute('data-node-id', 'port:outside');
  });

  it('focuses on a single click without leaving the drill-in', async () => {
    const user = userEvent.setup();
    const { proxy } = setup();
    await user.click(proxy);
    expect(ui().focusedId).toBe('port:outside');
    expect(ui().drill).toHaveLength(1);
    expect(ui().selection.nodes).toEqual([]);
  });

  it('goes to the real card on double-click: up a level, selected and focused', async () => {
    const user = userEvent.setup();
    const { proxy } = setup();
    await user.dblClick(proxy);
    expect(ui().drill).toEqual([]);
    expect(ui().selection.nodes).toEqual(['outside']);
    expect(ui().focusedId).toBe('outside');
  });

  it('goes to the real card on Enter without opening a details drawer', () => {
    const { proxy } = setup();
    proxy.focus();
    fireEvent.keyDown(proxy, { key: 'Enter' });
    expect(ui().drill).toEqual([]);
    expect(ui().selection.nodes).toEqual(['outside']);
    expect(ui().focusedId).toBe('outside');
    expect(ui().drawer.open).toBe(false);
  });

  it('can be neither dragged nor resized: no drag or resize handles', () => {
    const { proxy } = setup();
    expect(proxy.closest('[class*="resize"]')).toBeNull();
    expect(document.querySelector('.sd-resize-handle')).toBeNull();
    expect(proxy).not.toHaveAttribute('draggable', 'true');
  });
});
