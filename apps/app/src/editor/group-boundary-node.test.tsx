import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeProps } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import type { GroupFlowNode } from './deck-to-flow';
import { GroupBoundaryNode } from './group-boundary-node';
import { resolveLook } from './style/card-style';

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
    expect(boundary).toHaveAttribute('title', 'Double-click to rename, ↵ to open');
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

  it('edits the group label in place, inside the same pill (019 FR-008)', async () => {
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
    // The pill stays while renaming: same frame, chevron and count; the field takes the title's
    // place on one line, as wide as its text.
    const pill = field.parentElement;
    expect(pill).toHaveClass('rounded-full', 'h-7', 'border-[1.5px]');
    expect(pill).toHaveTextContent('8');
    expect(field).toHaveClass('whitespace-nowrap');
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

describe('GroupBoundaryNode Deck frame (029 US5)', () => {
  const props = {
    id: 'group:core',
    data: { title: 'Core services', count: 8, focused: false },
    width: 300,
    height: 200,
  } as unknown as NodeProps<GroupFlowNode>;

  it('draws a radius 20 solid frame', () => {
    renderWithEditor(<GroupBoundaryNode {...props} />);
    const frame = screen.getByTestId('group-boundary');
    expect(frame).toHaveClass('rounded-frame', 'border-solid', 'border-[1.5px]');
    expect(frame).not.toHaveClass('border-dashed');
  });

  it('has a label pill on the top edge with the name and the count', () => {
    renderWithEditor(<GroupBoundaryNode {...props} />);
    const pill = screen.getByRole('button', { name: 'Core services group, 8 nodes' });
    expect(pill).toHaveClass('rounded-full', 'h-7');
    // The pill and its connect handle sit in one row on the top edge.
    expect(pill.parentElement).toHaveClass('-top-3.5', 'left-4');
    expect(within(pill).getByText('Core services')).toBeInTheDocument();
    expect(within(pill).getByText('8')).toHaveClass('rounded-full', 'bg-ink');
  });

  it('keeps the drop-target cue: dashed primary border and the chip', () => {
    renderWithEditor(<GroupBoundaryNode {...props} />);
    act(() => {
      useUiStore.getState().setDropTarget('core');
    });
    expect(screen.getByTestId('group-boundary')).toHaveClass('border-dashed', 'border-primary');
    expect(screen.getByText('Drop into Core services')).toBeInTheDocument();
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

  it('shows a lock glyph, says "locked" and draws no handles on a locked group (054)', () => {
    renderWithEditor(
      <GroupBoundaryNode
        {...props({
          data: {
            title: 'Core services',
            count: 2,
            focused: false,
            level: 'system',
            selected: true,
            locked: true,
          },
        })}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Core services group, 2 nodes, locked' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('group-lock')).toBeInTheDocument();
    expect(document.querySelectorAll('.react-flow__resize-control')).toHaveLength(0);
    expect(document.querySelectorAll('.sd-group-handle[aria-hidden]')).toHaveLength(0);
  });

  it('shows no lock glyph on an unlocked group', () => {
    renderWithEditor(<GroupBoundaryNode {...props()} />);
    expect(screen.queryByTestId('group-lock')).not.toBeInTheDocument();
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

describe('GroupBoundaryNode colour (020 T052)', () => {
  const props = (dataPatch: Record<string, unknown> = {}) =>
    ({
      id: 'group:core',
      data: { title: 'Core services', count: 2, focused: false, ...dataPatch },
      width: 300,
      height: 200,
    }) as unknown as NodeProps<GroupFlowNode>;

  it('extends the accessible description with "Teal fill" for a fill', () => {
    const look = resolveLook({ fill: 'teal' });
    renderWithEditor(<GroupBoundaryNode {...props({ look })} />);
    expect(screen.getByRole('button', { name: /Core services group/ })).toHaveAttribute(
      'aria-description',
      expect.stringContaining('Teal fill'),
    );
  });

  it('extends the accessible description with "Red stroke", and sets data-stroke, for a stroke', () => {
    const look = resolveLook({ stroke: 'red' });
    renderWithEditor(<GroupBoundaryNode {...props({ look })} />);
    const boundary = screen.getByTestId('group-boundary');
    expect(boundary).toHaveAttribute('data-stroke');
    expect(screen.getByRole('button', { name: /Core services group/ })).toHaveAttribute(
      'aria-description',
      expect.stringContaining('Red stroke'),
    );
  });

  it('sets data-text="light" on the boundary for a custom dark fill', () => {
    const look = resolveLook({ fill: '#1c1c1a' });
    renderWithEditor(<GroupBoundaryNode {...props({ look })} />);
    expect(screen.getByTestId('group-boundary')).toHaveAttribute('data-text', 'light');
  });
});

describe('GroupBoundaryNode as a connector end (050 US4)', () => {
  const props = {
    id: 'group:core',
    data: { title: 'Core services', count: 2, focused: false },
    width: 300,
    height: 200,
  } as unknown as NodeProps<GroupFlowNode>;
  const file = deckOf({ groups: [{ id: 'core', title: 'Core services' }] });

  it('connects from the middle of any side, like a card; Enter opens the connect popover', async () => {
    const user = userEvent.setup();
    renderWithEditor(<GroupBoundaryNode {...props} />, file);
    const handles = screen.getAllByRole('button', { name: 'Connect from Core services' });
    expect(handles.map((h) => h.getAttribute('data-handleid'))).toEqual([
      'top',
      'right',
      'bottom',
      'left',
    ]);
    for (const handle of handles) {
      expect(handle).toHaveClass('react-flow__handle', 'source', 'connectable');
    }
    const right = handles[1];
    right?.focus();
    await user.keyboard('{Enter}');
    expect(useUiStore.getState().popover).toEqual({ kind: 'connect', fromId: 'core' });
  });

  it('shows the side handles while selected, and takes none in flow mode', () => {
    renderWithEditor(
      <GroupBoundaryNode {...props} data={{ ...props.data, selected: true }} />,
      file,
    );
    const handles = () => screen.getAllByRole('button', { name: 'Connect from Core services' });
    for (const handle of handles()) expect(handle).toHaveClass('opacity-100');
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
    for (const handle of handles()) {
      expect(handle).not.toHaveClass('connectable');
      expect(handle).toHaveClass('pointer-events-none');
    }
  });

  it('highlights the frame while a dragged connector end would attach to it', () => {
    renderWithEditor(<GroupBoundaryNode {...props} />, file);
    const boundary = screen.getByTestId('group-boundary');
    expect(boundary).not.toHaveAttribute('data-endpoint-target');
    act(() => {
      useUiStore.getState().setEndpointPreview({
        edgeId: 'e1',
        end: 'target',
        targetId: 'core',
        targetKind: 'group',
        box: { x: 0, y: 0, width: 300, height: 200 },
        side: 'right',
        at: 0.5,
        point: { x: 300, y: 100 },
        snapped: true,
        automatic: false,
        valid: 'ok',
      });
    });
    expect(boundary).toHaveAttribute('data-endpoint-target', 'ok');
    expect(boundary).toHaveClass('border-primary');
    act(() => {
      useUiStore.getState().setEndpointPreview(null);
    });
    expect(boundary).not.toHaveAttribute('data-endpoint-target');
  });
});

describe('GroupBoundaryNode label pill (051 follow-up)', () => {
  const props = (width = 300) =>
    ({
      id: 'group:core',
      data: { title: 'Core services', count: 8, focused: false },
      width,
      height: 200,
    }) as unknown as NodeProps<GroupFlowNode>;
  const file = deckOf({ groups: [{ id: 'core', title: 'Core services' }] });

  it('the chevron collapses the group; there is no other collapse button', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<GroupBoundaryNode {...props()} />, file);
    expect(screen.queryByRole('button', { name: 'Collapse Core services' })).toBeNull();
    await user.click(screen.getByTestId('group-collapse'));
    expect(toJSON(doc).views[0]?.collapsed).toEqual(['core']);
    expect(useUiStore.getState().selection.groups).toEqual(['core']);
    expect(useUiStore.getState().focusedId).toBe('collapsed:core');
    expect(useUiStore.getState().announcement.text).toBe('Core services collapsed');
  });

  it('never runs past its frame: 16 px in from each side, at most 288 px', () => {
    const { unmount } = renderWithEditor(<GroupBoundaryNode {...props(200)} />, file);
    const pill = () => screen.getByRole('button', { name: 'Core services group, 8 nodes' });
    expect(pill()).toHaveStyle({ maxWidth: '168px' });
    expect(within(pill()).getByText('Core services')).toHaveClass('truncate');
    expect(within(pill()).getByText('8')).toHaveClass('shrink-0');
    unmount();
    renderWithEditor(<GroupBoundaryNode {...props(900)} />, file);
    expect(pill()).toHaveStyle({ maxWidth: '288px' });
  });

  it('keeps the same width limit while renaming', () => {
    renderWithEditor(<GroupBoundaryNode {...props(200)} />, file);
    act(() => {
      useUiStore.getState().startTitleEdit({ target: 'group', id: 'core', isNew: false });
    });
    const pill = screen.getByRole('textbox', { name: 'Group title' }).parentElement;
    expect(pill).toHaveStyle({ maxWidth: '168px' });
  });
});
