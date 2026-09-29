import { toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeProps } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import type { CollapsedFlowNode } from './deck-to-flow';
import { CollapsedGroupNode } from './collapsed-group-node';

let reduced = false;
vi.mock('@sododeck/ui/hooks/use-reduced-motion', () => ({ useReducedMotion: () => reduced }));

describe('CollapsedGroupNode', () => {
  function props(patch: Partial<NonNullable<NodeProps<CollapsedFlowNode>['data']>> = {}) {
    return {
      id: 'collapsed:core',
      data: {
        groupId: 'core',
        title: 'Core services',
        nodeCount: 8,
        edgeCount: 12,
        focused: true,
        dimmed: false,
        ...patch,
      },
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

  it('shows the flow-inside ring and dot, naming the hidden step', () => {
    reduced = false;
    renderWithEditor(<CollapsedGroupNode {...props({ flowInside: 'current' })} />, deckOf({}));
    expect(
      screen.getByRole('button', {
        name: 'Core services, collapsed group, 8 nodes, 12 edges, flow step inside',
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('collapsed-flow-ring')).toBeInTheDocument();
    expect(screen.getByTestId('collapsed-flow-dot')).toHaveClass('sd-flow-inside-dot');
  });

  it('keeps the dot static under reduced motion', () => {
    reduced = true;
    renderWithEditor(<CollapsedGroupNode {...props({ flowInside: 'current' })} />, deckOf({}));
    expect(screen.getByTestId('collapsed-flow-dot')).not.toHaveClass('sd-flow-inside-dot');
  });

  it('edits the group title in place (019 FR-008)', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(
      <CollapsedGroupNode {...props()} />,
      deckOf({ groups: [{ id: 'core', title: 'Core services' }] }),
    );
    act(() => {
      useUiStore.getState().startTitleEdit({ target: 'group', id: 'core', isNew: false });
    });
    const field = screen.getByRole('textbox', { name: 'Group title' });
    expect(field).toHaveValue('Core services');
    await user.keyboard('Core{Enter}');
    expect(toJSON(doc).groups[0]?.title).toBe('Core');
    expect(useUiStore.getState().titleEdit).toBeNull();
  });
});
