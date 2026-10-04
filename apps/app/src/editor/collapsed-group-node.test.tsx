import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeProps } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import type { CollapsedFlowNode } from './deck-to-flow';
import { CollapsedGroupNode } from './collapsed-group-node';
import { resolveLook } from './style/card-style';

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
        members: [],
        ...patch,
      },
      selected: false,
      width: 180,
      height: 64,
    } as unknown as NodeProps<CollapsedFlowNode>;
  }

  it('folds the step state into a sticker on the front card, with no pulsing dot (035)', () => {
    renderWithEditor(
      <CollapsedGroupNode {...props({ flowInside: 'current', flowNumber: '3' })} />,
      deckOf({}),
    );
    const front = screen.getByRole('button', { name: /^Core services, collapsed group/ });
    expect(front).toHaveAccessibleName(/, flow step inside$/);
    const sticker = within(front).getByTestId('step-sticker');
    expect(sticker).toHaveAttribute('data-step-state', 'current');
    expect(sticker).toHaveTextContent('3');
    expect(sticker).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByTestId('collapsed-flow-dot')).toBeNull();
  });

  it('shows the merged database chip of the cards inside and says it (049)', () => {
    const chip = {
      text: 'writes orders +2',
      access: 'write' as const,
      tables: [
        { title: 'orders', access: 'write' as const },
        { title: 'items', access: 'write' as const },
        { title: 'customers', access: 'read' as const },
      ],
    };
    renderWithEditor(<CollapsedGroupNode {...props({ touchChip: chip })} />, deckOf({}));
    const front = screen.getByRole('button', { name: /^Core services, collapsed group/ });
    expect(front).toHaveAccessibleName(/, current step writes orders \+2$/);
    expect(within(front).getByTestId('touch-chip')).toHaveTextContent('writes orders +2');
  });

  it('has no sticker when no flow step is inside', () => {
    renderWithEditor(<CollapsedGroupNode {...props()} />, deckOf({}));
    expect(screen.queryByTestId('step-sticker')).toBeNull();
  });

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
        {...props({
          nodeCount: 3,
          members: [{ kind: 'service' }, { kind: 'service' }, { kind: 'database' }],
        })}
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
    const members = Array.from({ length: 9 }, () => ({ kind: 'service' }));
    renderWithEditor(<CollapsedGroupNode {...props({ nodeCount: 9, members })} />, deckOf({}));
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

  it('shows the flow-inside ring, naming the hidden step', () => {
    renderWithEditor(<CollapsedGroupNode {...props({ flowInside: 'current' })} />, deckOf({}));
    expect(
      screen.getByRole('button', {
        name: 'Core services, collapsed group, 8 nodes, 12 edges, flow step inside',
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('collapsed-flow-ring')).toBeInTheDocument();
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
        members: [],
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

describe('CollapsedGroupNode member tiles (030)', () => {
  it('draws each member type icon and the fallback for an unknown id', () => {
    const { container } = renderWithEditor(
      <CollapsedGroupNode
        {...(() => {
          const base = {
            id: 'collapsed:core',
            data: {
              groupId: 'core',
              title: 'Core',
              nodeCount: 3,
              edgeCount: 0,
              focused: true,
              dimmed: false,
              members: [{ kind: 'warehouse' }, { kind: 'truck-route' }, { kind: 'robot' }],
            },
            selected: false,
            width: 180,
            height: 64,
          };
          return base as unknown as NodeProps<CollapsedFlowNode>;
        })()}
      />,
      deckOf({}),
    );
    const tiles = [...container.querySelectorAll('[data-testid="member-tile"] svg')];
    expect(tiles.map((svg) => svg.getAttribute('data-icon'))).toEqual([
      'lucide:warehouse',
      'lucide:truck',
      'lucide:shapes',
    ]);
  });

  it("draws each member's own icon, and the type icon for one it cannot show (038)", () => {
    const { container } = renderWithEditor(
      <CollapsedGroupNode
        {...({
          id: 'collapsed:core',
          data: {
            groupId: 'core',
            title: 'Core',
            nodeCount: 3,
            edgeCount: 0,
            focused: true,
            dimmed: false,
            members: [
              { kind: 'service', icon: 'lucide:search' },
              { kind: 'service' },
              { kind: 'database', icon: 'simple:kafka' },
            ],
          },
          selected: false,
          width: 180,
          height: 64,
        } as unknown as NodeProps<CollapsedFlowNode>)}
      />,
      deckOf({}),
    );
    const tiles = [...container.querySelectorAll('[data-testid="member-tile"] svg')];
    expect(tiles.map((svg) => svg.getAttribute('data-icon'))).toEqual([
      'lucide:search',
      'lucide:box',
      'lucide:database',
    ]);
  });
});
