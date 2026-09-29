import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen } from '@testing-library/react';
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
    renderWithEditor(<GroupBoundaryNode {...props} />);
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

  it('renders a solid landscape region with a large label', () => {
    const props = {
      id: 'group:core',
      data: { title: 'Core services', count: 8, focused: false, level: 'landscape' },
      width: 300,
      height: 200,
    } as unknown as NodeProps<GroupFlowNode>;
    renderWithEditor(<GroupBoundaryNode {...props} />);
    expect(screen.getByTestId('group-boundary')).toHaveAttribute('data-level', 'landscape');
    expect(screen.getByTestId('group-boundary')).toHaveClass('border-solid');
    expect(screen.getByRole('button', { name: 'Core services group, 8 nodes' })).toHaveClass(
      'text-body',
    );
  });

  it('edits the group label in place and keeps double-click drilling in (019 FR-008)', async () => {
    const user = userEvent.setup();
    const props = {
      id: 'group:core',
      data: { title: 'Core services', count: 8, focused: false },
      width: 300,
      height: 200,
    } as unknown as NodeProps<GroupFlowNode>;
    const { doc, editor } = renderWithEditor(
      <GroupBoundaryNode {...props} />,
      deckOf({ groups: [{ id: 'core', title: 'Core services' }] }),
    );
    act(() => {
      useUiStore.getState().startTitleEdit({ target: 'group', id: 'core', isNew: false });
    });
    expect(screen.queryByRole('button', { name: 'Core services group, 8 nodes' })).toBeNull();
    const field = screen.getByRole('textbox', { name: 'Group title' });
    expect(field).toHaveFocus();
    await user.keyboard('Billing{Escape}');
    expect(toJSON(doc).groups[0]?.title).toBe('Core services');
    expect(editor().canUndo()).toBe(false);
    act(() => {
      useUiStore.getState().startTitleEdit({ target: 'group', id: 'core', isNew: false });
    });
    fireEvent.doubleClick(screen.getByRole('textbox', { name: 'Group title' }));
    await user.keyboard('Billing{Enter}');
    expect(toJSON(doc).groups[0]?.title).toBe('Billing');
  });
});

describe('GroupBoundaryNode as a frame (016)', () => {
  const props = (patch: Partial<NodeProps<GroupFlowNode>> = {}) =>
    ({
      id: 'group:core',
      data: { title: 'Core services', count: 2, focused: false },
      width: 300,
      height: 200,
      ...patch,
    }) as unknown as NodeProps<GroupFlowNode>;

  it('drags by the label and an edge band; empty space inside lets the pointer through', () => {
    renderWithEditor(<GroupBoundaryNode {...props()} />);
    const label = screen.getByRole('button', { name: 'Core services group, 2 nodes' });
    expect(label).toHaveClass('sd-group-handle');
    const boundary = screen.getByTestId('group-boundary');
    expect(boundary).toHaveClass('pointer-events-none');
    expect(boundary.querySelectorAll('.sd-group-handle[aria-hidden]')).toHaveLength(4);
  });

  it('shows eight resize handles only while selected and editable', () => {
    const { unmount } = renderWithEditor(<GroupBoundaryNode {...props()} />);
    expect(document.querySelectorAll('.react-flow__resize-control')).toHaveLength(0);
    unmount();
    renderWithEditor(
      <GroupBoundaryNode
        {...props({
          data: {
            title: 'Core services',
            count: 2,
            focused: false,
            level: 'system',
            selected: true,
          },
        })}
      />,
    );
    expect(document.querySelectorAll('.react-flow__resize-control.sd-resize-handle')).toHaveLength(
      8,
    );
    act(() => {
      useUiStore.setState({
        activeFlow: {
          flowId: 'f',
          stepId: null,
          branchId: null,
          alternativeId: null,
          playing: false,
          speed: 1,
        },
      });
    });
    expect(document.querySelectorAll('.react-flow__resize-control')).toHaveLength(0);
    expect(document.querySelectorAll('.sd-group-handle[aria-hidden]')).toHaveLength(0);
  });

  it('highlights a drop target with a dashed border and a chip (screen 110)', () => {
    renderWithEditor(<GroupBoundaryNode {...props()} />);
    expect(screen.queryByText('Drop into Core services')).toBeNull();
    act(() => {
      useUiStore.getState().setDropTarget('core');
    });
    expect(screen.getByText('Drop into Core services')).toBeInTheDocument();
    const boundary = screen.getByTestId('group-boundary');
    expect(boundary).toHaveAttribute('data-drop-target');
    expect(boundary).toHaveClass('border-dashed', 'border-primary');
  });
});
