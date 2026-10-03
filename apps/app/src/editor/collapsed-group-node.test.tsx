import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeProps } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import type { CollapsedFlowNode } from './deck-to-flow';
import { CollapsedGroupNode } from './collapsed-group-node';
import { resolveLook } from './style/card-style';

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
        memberKinds: [],
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
  });

  it('counts one node and one edge in the singular, in the name', () => {
    renderWithEditor(<CollapsedGroupNode {...props({ nodeCount: 1, edgeCount: 1 })} />, deckOf({}));
    expect(
      screen.getByRole('button', { name: 'Core services, collapsed group, 1 nodes, 1 edges' }),
    ).toBeInTheDocument();
  });

  it('is the front card of a fanned hand: Group, count, name and one tile per member', () => {
    renderWithEditor(
      <CollapsedGroupNode
        {...props({ nodeCount: 3, memberKinds: ['service', 'service', 'database'] })}
      />,
      deckOf({}),
    );
    const front = screen.getByRole('button', { name: /^Core services, collapsed group/ });
    expect(within(front).getByText('Group')).toBeInTheDocument();
    expect(within(front).getByText('3')).toBeInTheDocument();
    expect(within(front).getByText('Core services')).toBeInTheDocument();
    expect(front.querySelectorAll('[data-testid="member-tile"]')).toHaveLength(3);
    expect(front.querySelector('[data-testid="member-more"]')).toBeNull();
  });

  it('shows the members that fit and the rest as "+n"', () => {
    const memberKinds = Array.from({ length: 9 }, () => 'service');
    renderWithEditor(<CollapsedGroupNode {...props({ nodeCount: 9, memberKinds })} />, deckOf({}));
    const front = screen.getByRole('button', { name: /^Core services, collapsed group/ });
    expect(front.querySelectorAll('[data-testid="member-tile"]')).toHaveLength(4);
    expect(within(front).getByText('+5')).toBeInTheDocument();
  });

  it('draws two back sheets that are hidden, unfocusable and ignore the pointer', () => {
    renderWithEditor(<CollapsedGroupNode {...props()} />, deckOf({}));
    const sheets = screen.getAllByTestId('group-back-sheet');
    expect(sheets).toHaveLength(2);
    for (const sheet of sheets) {
      expect(sheet).toHaveAttribute('aria-hidden', 'true');
      expect(sheet).toHaveClass('pointer-events-none');
      expect(sheet).not.toHaveAttribute('tabindex');
    }
    expect(screen.getAllByRole('button')).toHaveLength(1);
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

describe('CollapsedGroupNode colour (020 T052)', () => {
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
        memberKinds: [],
        ...patch,
      },
      selected: false,
      width: 180,
      height: 64,
    } as unknown as NodeProps<CollapsedFlowNode>;
  }

  it('renders the same description as a card, coloured', () => {
    const look = resolveLook({ fill: 'teal' });
    renderWithEditor(<CollapsedGroupNode {...props({ look })} />, deckOf({}));
    expect(
      screen.getByRole('button', {
        name: 'Core services, collapsed group, 8 nodes, 12 edges',
      }),
    ).toHaveAttribute('aria-description', expect.stringContaining('Teal fill'));
  });
});
