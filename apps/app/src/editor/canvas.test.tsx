import { toJSON } from '@sododeck/model';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Edge, Node, NodeChange } from '@xyflow/react';
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, editorWrapper, renderWithEditor } from '../test/render-canvas';
import { Canvas } from './canvas';
import { KIND_MIME, useCanvasHandlers } from './use-canvas-handlers';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'database', title: 'B', position: { x: 300, y: 0 } },
    { id: 'c', type: 'queue', title: 'C', position: { x: 0, y: 200 } },
    { id: 'd', type: 'client', title: 'D', position: { x: 300, y: 200 } },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b', label: 'calls', protocol: 'http', direction: 'both' },
    { id: 'e2', from: 'b', to: 'c' },
    { id: 'e3', from: 'c', to: 'd' },
  ],
});

const ui = () => useUiStore.getState();
const click = (patch: Partial<ReactMouseEvent> = {}) =>
  ({ shiftKey: false, metaKey: false, ctrlKey: false, ...patch }) as ReactMouseEvent;
const flowNode = (id: string) => ({ id }) as Node;
const flowEdge = (id: string) => ({ id }) as Edge;

function handlers(file = deck) {
  const env = editorWrapper(file);
  const { result } = renderHook(() => useCanvasHandlers(), { wrapper: env.wrapper });
  return { ...env, h: () => result.current };
}

describe('Canvas', () => {
  it('renders every component and the canvas region', () => {
    renderWithEditor(<Canvas />, deck);
    expect(screen.getByLabelText('Diagram canvas')).toBeInTheDocument();
    expect(screen.getAllByTestId('deck-node')).toHaveLength(4);
    expect(screen.getByLabelText('Minimap')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Labels' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Fit diagram' })).toBeInTheDocument();
  });

  it('writes nothing on open, even for components without positions', () => {
    const { editor } = renderWithEditor(
      <Canvas />,
      deckOf({ nodes: [{ id: 'x', type: 'service', title: 'X' }] }),
    );
    expect(editor().canUndo()).toBe(false);
  });

  it('shows the empty-canvas card only for an empty deck', async () => {
    const user = userEvent.setup();
    const { editor } = renderWithEditor(<Canvas />, deckOf({}));
    expect(screen.getByRole('heading', { name: 'Start your diagram' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open palette' }));
    expect(ui().leftTab).toBe('palette');
    act(() => {
      editor().add('nodes', { type: 'service', title: 'S' });
    });
    expect(screen.queryByRole('heading', { name: 'Start your diagram' })).not.toBeInTheDocument();
  });

  it('adds the dropped kind at the drop point, and ignores other drops', () => {
    const { doc } = renderWithEditor(<Canvas />, deckOf({}));
    const canvas = screen.getByLabelText('Diagram canvas');
    const data = (types: string[], value = '') => ({
      dataTransfer: {
        types,
        getData: (type: string) => (types.includes(type) ? value : ''),
        dropEffect: '',
      },
      clientX: 400,
      clientY: 300,
    });
    fireEvent.drop(canvas, data(['text/plain'], 'service'));
    expect(toJSON(doc).nodes).toHaveLength(0);
    fireEvent.dragOver(canvas, data([KIND_MIME]));
    fireEvent.drop(canvas, data([KIND_MIME], 'database'));
    const [node] = toJSON(doc).nodes;
    expect(node).toMatchObject({ type: 'database', title: 'New database' });
    expect(ui().selection.nodes).toEqual([node?.id]);
    expect(ui().announcement.text).toBe('Added New database');
  });

  it('creates nothing when a palette card is dropped outside the canvas', () => {
    const { doc } = renderWithEditor(<Canvas />, deckOf({}));
    fireEvent.drop(document.body, {
      dataTransfer: { types: [KIND_MIME], getData: () => 'service', dropEffect: '' },
    });
    expect(toJSON(doc).nodes).toEqual([]);
  });

  it('draws a selection frame around two or more selected components', () => {
    renderWithEditor(<Canvas />, deck);
    act(() => {
      ui().select({ nodes: ['a'] });
    });
    expect(screen.queryByTestId('selection-frame')).not.toBeInTheDocument();
    act(() => {
      ui().select({ nodes: ['a', 'b'] });
    });
    expect(screen.getByTestId('selection-frame')).toBeInTheDocument();
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('drops selection, focus and popovers that point at removed objects', () => {
    const { editor } = renderWithEditor(<Canvas />, deck);
    act(() => {
      ui().select({ nodes: ['a'], edges: ['e3'] });
      ui().openEdgePopover('e1');
    });
    act(() => {
      editor().remove('nodes', 'a');
    });
    expect(ui().selection).toEqual({ nodes: [], edges: ['e3'] });
    expect(ui().popover).toBeNull();
  });

  it('selects what undo brings back, and closes a popover whose edge undo removed', () => {
    const { editor } = renderWithEditor(<Canvas />, deck);
    act(() => {
      editor().remove('nodes', 'b');
    });
    act(() => {
      editor().undo();
    });
    expect(ui().selection).toEqual({ nodes: ['b'], edges: ['e1', 'e2'] });

    let id = '';
    act(() => {
      id = editor().add('edges', { from: 'a', to: 'd' });
      ui().openEdgePopover(id);
    });
    act(() => {
      editor().undo();
    });
    expect(ui().popover).toBeNull();
  });

  it('is one Tab stop that hands focus to the selected or first component', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Canvas />
      </>,
      { wrapper: editorWrapper(deck).wrapper },
    );
    const canvas = screen.getByLabelText('Diagram');
    const tabStops = () =>
      [...document.querySelectorAll('[data-canvas], [data-canvas] [tabindex]')].filter(
        (el) => el.getAttribute('tabindex') === '0',
      );
    expect(tabStops()).toEqual([canvas]);

    act(() => {
      canvas.focus();
    });
    const nodeA = screen.getByRole('group', { name: 'Service: A' });
    await waitFor(() => {
      expect(nodeA).toHaveFocus();
    });
    expect(ui().focusedId).toBe('a');
    // Now the node carries the Tab stop (plus its four handles); the canvas itself does not.
    expect(canvas).toHaveAttribute('tabindex', '-1');
    expect(tabStops()).toEqual([
      nodeA,
      ...screen.getAllByRole('button', { name: 'Connect from A' }),
    ]);

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
  });
});

describe('canvas handlers', () => {
  it('selects one item by click, toggles with shift/⌘, clears on the pane', () => {
    const { h } = handlers();
    act(() => {
      h().onNodeClick(click(), flowNode('a'));
    });
    expect(ui().selection).toEqual({ nodes: ['a'], edges: [] });
    expect(ui().focusedId).toBe('a');
    act(() => {
      h().onNodeClick(click({ shiftKey: true }), flowNode('b'));
      h().onEdgeClick(click({ metaKey: true }), flowEdge('e1'));
    });
    expect(ui().selection).toEqual({ nodes: ['a', 'b'], edges: ['e1'] });
    act(() => {
      h().onNodeClick(click({ ctrlKey: true }), flowNode('a'));
    });
    expect(ui().selection).toEqual({ nodes: ['b'], edges: ['e1'] });
    act(() => {
      h().onPaneClick();
    });
    expect(ui().selection).toEqual({ nodes: [], edges: [] });
  });

  it('takes the marquee selection from React Flow, ignoring group boundaries', () => {
    const { h } = handlers();
    act(() => {
      h().onSelectionStart();
      h().onNodesChange([
        { type: 'select', id: 'a', selected: true },
        { type: 'select', id: 'group:g', selected: true },
        { type: 'select', id: 'c', selected: true },
      ]);
      h().onEdgesChange([{ type: 'select', id: 'e1', selected: true }]);
      h().onSelectionEnd();
    });
    expect(ui().selection).toEqual({ nodes: ['a', 'c'], edges: ['e1'] });
    // Outside a marquee, React Flow's own selection changes are ignored.
    act(() => {
      h().onNodesChange([{ type: 'select', id: 'b', selected: true }]);
    });
    expect(ui().selection.nodes).toEqual(['a', 'c']);
  });

  it('moves every dragged component as one undo step', () => {
    const { h, doc, editor } = handlers();
    act(() => {
      ui().select({ nodes: ['a', 'b'] });
    });
    const move = (dx: number): NodeChange[] => [
      { type: 'position', id: 'a', position: { x: dx + 0.4, y: dx }, dragging: true },
      { type: 'position', id: 'b', position: { x: 300 + dx, y: dx }, dragging: true },
    ];
    act(() => {
      h().onNodeDragStart({}, flowNode('a'));
      for (let dx = 1; dx <= 30; dx++) h().onNodesChange(move(dx));
      h().onNodeDragStop();
    });
    const nodes = toJSON(doc).nodes;
    expect(nodes[0]?.position).toEqual({ x: 30, y: 30 });
    expect(nodes[1]?.position).toEqual({ x: 330, y: 30 });
    act(() => {
      editor().undo();
    });
    expect(
      toJSON(doc)
        .nodes.slice(0, 2)
        .map((n) => n.position),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ]);
    expect(editor().canUndo()).toBe(false);
  });

  it('selects an unselected component when its drag starts', () => {
    const { h } = handlers();
    act(() => {
      ui().select({ nodes: ['a', 'b'] });
      h().onNodeDragStart({}, flowNode('c'));
      h().onNodeDragStop();
    });
    expect(ui().selection.nodes).toEqual(['c']);
  });

  it('refuses self and duplicate connections', () => {
    const { h } = handlers();
    const conn = (source: string, target: string) => ({
      source,
      target,
      sourceHandle: null,
      targetHandle: null,
    });
    expect(h().isValidConnection(conn('a', 'a'))).toBe(false);
    expect(h().isValidConnection(conn('a', 'b'))).toBe(false);
    expect(h().isValidConnection(conn('b', 'a'))).toBe(false);
    expect(h().isValidConnection(conn('a', 'd'))).toBe(true);
  });

  it('connects, selects the new edge, opens its popover and announces it', () => {
    const { h, doc } = handlers();
    act(() => {
      h().onConnect({ source: 'a', target: 'd', sourceHandle: 'right', targetHandle: 'body' });
    });
    const edge = toJSON(doc).edges.at(-1);
    expect(edge).toMatchObject({ from: 'a', to: 'd' });
    expect(ui().selection.edges).toEqual([edge?.id]);
    expect(ui().popover).toEqual({ kind: 'edge', edgeId: edge?.id });
    expect(ui().announcement.text).toBe('Connected A to D');
    // A duplicate reaching onConnect anyway is still refused.
    act(() => {
      h().onConnect({ source: 'd', target: 'a', sourceHandle: null, targetHandle: null });
    });
    expect(toJSON(doc).edges).toHaveLength(4);
  });

  it('opens the popover on double-click of an edge', () => {
    const { h } = handlers();
    act(() => {
      h().onEdgeDoubleClick(click(), flowEdge('e2'));
    });
    expect(ui().popover).toEqual({ kind: 'edge', edgeId: 'e2' });
    expect(ui().selection.edges).toEqual(['e2']);
  });

  it('reconnects an endpoint, keeping id and fields; refuses invalid targets', () => {
    const { h, doc } = handlers();
    const old = { id: 'e1', source: 'a', target: 'b' } as Edge;
    const to = (target: string) => ({
      source: 'a',
      target,
      sourceHandle: null,
      targetHandle: null,
    });
    act(() => {
      h().onReconnect(old, to('a'));
    });
    expect(ui().announcement.text).toBe("Can't connect to itself");
    act(() => {
      h().onReconnect(old, to('c'));
    });
    expect(toJSON(doc).edges[0]).toEqual({
      id: 'e1',
      from: 'a',
      to: 'c',
      protocol: 'http',
      label: 'calls',
      direction: 'both',
    });
    act(() => {
      h().onReconnect({ ...old, target: 'c' }, { ...to('c'), source: 'b' });
    });
    // b–c is already connected by e2: refused, unchanged.
    expect(toJSON(doc).edges[0]).toMatchObject({ from: 'a', to: 'c' });
    expect(ui().announcement.text).toBe('Already connected');
  });
});

describe('canvas during a flow session (006 FR-017)', () => {
  it('records edge clicks, previews hovered edges, ignores node clicks and drops', () => {
    const { h, doc } = handlers();
    act(() => {
      ui().startRecording('Place order', null);
    });
    act(() => {
      h().onNodeClick(click(), flowNode('a'));
      h().onEdgeMouseEnter(click(), flowEdge('e1'));
    });
    expect(ui().selection).toEqual({ nodes: [], edges: [] });
    expect(ui().hoverEdgeId).toBe('e1');
    act(() => {
      h().onEdgeClick(click(), flowEdge('e1'));
      h().onEdgeMouseLeave();
    });
    expect(ui().hoverEdgeId).toBeNull();
    expect(ui().selection.edges).toEqual([]);
    expect(
      toJSON(doc)
        .flows.at(-1)
        ?.steps.map((s) => s.edge),
    ).toEqual(['e1']);

    const before = toJSON(doc);
    const drop = {
      clientX: 0,
      clientY: 0,
      preventDefault: () => undefined,
      dataTransfer: { types: [KIND_MIME], getData: () => 'service', dropEffect: '' },
    } as unknown as DragEvent;
    act(() => {
      h().onDrop(drop);
      h().onEdgeDoubleClick(click(), flowEdge('e1'));
    });
    expect(toJSON(doc).nodes).toEqual(before.nodes);
    expect(ui().popover).toBeNull();
  });
});
