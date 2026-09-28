import { toJSON, type DeckEditor } from '@sododeck/model';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Edge, Node, NodeChange } from '@xyflow/react';
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { playbackDeck } from '../test/flow-fixtures';
import { deckOf, editorWrapper, renderWithEditor } from '../test/render-canvas';
import { Canvas } from './canvas';
import { exitFlow, openFlow } from './flows/flow-mode';
import { TopBar } from './top-bar';
import { KIND_MIME, NOTE_MIME, useCanvasHandlers } from './use-canvas-handlers';
import { useEditorShortcuts } from './use-canvas-shortcuts';

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

const collapsedGroupsDeck = deckOf({
  nodes: [
    { id: 'a1', type: 'service', title: 'A1', group: 'left', position: { x: 0, y: 0 } },
    { id: 'a2', type: 'service', title: 'A2', group: 'left', position: { x: 0, y: 120 } },
    { id: 'b1', type: 'service', title: 'B1', group: 'right', position: { x: 420, y: 0 } },
    { id: 'b2', type: 'service', title: 'B2', group: 'right', position: { x: 420, y: 120 } },
  ],
  groups: [
    { id: 'left', title: 'Left' },
    { id: 'right', title: 'Right' },
  ],
  edges: Array.from({ length: 12 }, (_, index) => ({
    id: `m${String(index)}`,
    from: index % 2 === 0 ? 'a1' : 'a2',
    to: index % 3 === 0 ? 'b1' : 'b2',
  })),
});

const groupedPlaybackDeck = deckOf({
  ...playbackDeck,
  nodes: playbackDeck.nodes.map((node) =>
    node.id === 'b' || node.id === 'c' ? { ...node, group: 'core' } : node,
  ),
  groups: [{ id: 'core', title: 'Core services' }],
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

function DrillHarness() {
  useEditorShortcuts();
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  return (
    <MemoryRouter>
      <TopBar deckName={deck.name ?? 'Untitled deck'} deck={deck} />
      <Canvas />
    </MemoryRouter>
  );
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

  it('adds a dropped note at the drop point', () => {
    const { doc } = renderWithEditor(<Canvas />, deckOf({}));
    const canvas = screen.getByLabelText('Diagram canvas');
    fireEvent.dragOver(canvas, {
      dataTransfer: { types: [NOTE_MIME], getData: () => 'note', dropEffect: '' },
      clientX: 180,
      clientY: 140,
    });
    fireEvent.drop(canvas, {
      dataTransfer: { types: [NOTE_MIME], getData: () => 'note', dropEffect: '' },
      clientX: 180,
      clientY: 140,
    });
    const [sticky] = toJSON(doc).stickies;
    expect(sticky).toMatchObject({ text: '' });
    expect(Number.isInteger(sticky?.position?.x)).toBe(true);
    expect(Number.isInteger(sticky?.position?.y)).toBe(true);
    expect(ui().selection.stickies).toEqual([sticky?.id]);
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
    expect(ui().selection).toEqual({ nodes: [], edges: ['e3'], groups: [], stickies: [] });
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
    expect(ui().selection).toEqual({ nodes: ['b'], edges: ['e1', 'e2'], groups: [], stickies: [] });

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

  it('goes up when a drilled group disappears, including on undo', () => {
    const grouped = deckOf({
      nodes: [{ id: 'a', type: 'service', title: 'A', group: 'core' }],
      groups: [{ id: 'core', title: 'Core services' }],
    });
    const { editor } = renderWithEditor(<Canvas />, grouped);

    act(() => {
      ui().drillInto({
        kind: 'group',
        id: 'core',
        viewport: { x: 0, y: 0, zoom: 1 },
      });
    });
    act(() => {
      editor().remove('groups', 'core');
    });
    expect(ui().drill).toEqual([]);
    expect(ui().announcement.text).toBe('Went up to System view');

    let groupId = '';
    act(() => {
      editor().batch(() => {
        groupId = editor().add('groups', { title: 'Restored group' });
        editor().update('nodes', 'a', { group: groupId });
      });
      ui().drillInto({
        kind: 'group',
        id: groupId,
        viewport: { x: 0, y: 0, zoom: 1 },
      });
    });
    act(() => {
      editor().undo();
    });
    expect(ui().drill).toEqual([]);
    expect(ui().announcement.text).toBe('Went up to System view');
  });

  it('drills into groups and child nodes, shows the breadcrumb, and keeps the deck unchanged', async () => {
    const user = userEvent.setup();
    const drillDeck = deckOf({
      name: 'Shop',
      nodes: [
        { id: 'gateway', type: 'service', title: 'Gateway', position: { x: 0, y: 0 } },
        {
          id: 'a',
          type: 'service',
          title: 'Order Service',
          group: 'core',
          position: { x: 260, y: 0 },
        },
        {
          id: 'b',
          type: 'database',
          title: 'Orders DB',
          group: 'core',
          position: { x: 520, y: 0 },
        },
        { id: 'parent', type: 'service', title: 'Delivery platform', position: { x: 0, y: 220 } },
        {
          id: 'child',
          type: 'service',
          title: 'Dispatch',
          parent: 'parent',
          position: { x: 260, y: 220 },
        },
      ],
      groups: [{ id: 'core', title: 'Core services' }],
      edges: [
        { id: 'ga', from: 'gateway', to: 'a' },
        { id: 'ab', from: 'a', to: 'b' },
      ],
    });
    const before = structuredClone(drillDeck);
    const { doc, editor } = renderWithEditor(<DrillHarness />, drillDeck);

    fireEvent.doubleClick(screen.getByRole('button', { name: 'Core services group, 2 nodes' }));
    expect(ui().drill.map((frame) => frame.id)).toEqual(['core']);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      'Local/Shop/System view/Core services',
    );
    expect(screen.getAllByTestId('deck-node')).toHaveLength(2);
    expect(screen.queryByRole('group', { name: 'Service: Gateway' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Gateway' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to Gateway' }));
    expect(ui().drill).toEqual([]);
    expect(ui().selection.nodes).toEqual(['gateway']);

    act(() => {
      ui().focus('group:core');
      document.querySelector<HTMLElement>('[data-node-id="group:core"]')?.focus();
    });
    await user.keyboard('{Enter}');
    expect(ui().drill.map((frame) => frame.id)).toEqual(['core']);

    await user.keyboard('{Escape}');
    fireEvent.doubleClick(screen.getByRole('group', { name: 'Service: Gateway' }));
    expect(ui().drill).toEqual([]);

    fireEvent.doubleClick(await screen.findByRole('group', { name: 'Service: Delivery platform' }));
    expect(ui().drill.map((frame) => frame.id)).toEqual(['parent']);
    expect(screen.getAllByTestId('deck-node')).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Service: Dispatch' })).toBeInTheDocument();
    expect(toJSON(doc)).toEqual(before);
    expect(editor().canUndo()).toBe(false);
  });

  it('collapses a group from the keyboard, renders merged edges, and updates counts live', async () => {
    const user = userEvent.setup();
    const before = structuredClone(collapsedGroupsDeck);
    const { doc, unmount } = renderWithEditor(<Canvas />, collapsedGroupsDeck);

    act(() => {
      ui().focus('group:left');
      ui().select({ groups: ['left'] });
      document.querySelector<HTMLElement>('[data-node-id="group:left"]')?.focus();
    });
    await user.keyboard(' ');
    expect(ui().collapsed.has('left')).toBe(true);
    expect(ui().focusedId).toBe('collapsed:left');
    expect(screen.getByTestId('collapsed-group-node')).toHaveTextContent('2 nodes · 0 edges');

    expect(toJSON(doc)).toEqual(before);

    unmount();
    const merged = renderWithEditor(<Canvas />, collapsedGroupsDeck);
    act(() => {
      ui().setCollapsed('left', true);
      ui().setCollapsed('right', true);
    });
    expect(ui().collapsed.has('right')).toBe(true);

    act(() => {
      ui().setCollapsed('right', false);
    });
    expect(ui().collapsed.has('right')).toBe(false);

    act(() => {
      ui().setCollapsed('right', true);
      merged.editor().add('nodes', { type: 'service', title: 'A3', group: 'left' });
    });
    expect(
      screen.getByRole('button', {
        name: 'Left, collapsed group, 3 nodes, 0 edges',
      }),
    ).toBeInTheDocument();
  });

  it('replaces hidden selections with the collapsed group and clears them when drill hides them', () => {
    renderWithEditor(<Canvas />, collapsedGroupsDeck);

    act(() => {
      ui().select({ nodes: ['a1'], edges: ['m0'] });
      ui().setCollapsed('left', true);
    });
    expect(ui().selection).toEqual({ nodes: [], edges: [], groups: ['left'], stickies: [] });

    act(() => {
      ui().setCollapsed('left', false);
      ui().select({ nodes: ['a1'] });
    });
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Left group, 2 nodes' }));
    expect(ui().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
  });

  it('dims non-neighbours in focus mode, follows the selection, and leaves the deck unchanged', async () => {
    const user = userEvent.setup();
    const before = structuredClone(deck);
    const { container, doc } = renderWithEditor(<Canvas />, deck);

    act(() => {
      ui().select({ nodes: ['b'] });
      ui().setFocusMode(true);
    });
    const canvas = container.querySelector('[data-canvas]');
    expect(canvas).toHaveAttribute('data-focus-mode');
    expect(screen.getByRole('group', { name: 'Service: A' })).not.toHaveAttribute('aria-hidden');
    expect(screen.getByRole('group', { name: 'Database: B' })).not.toHaveAttribute('aria-hidden');
    expect(screen.getByRole('group', { name: 'Queue: C' })).not.toHaveAttribute('aria-hidden');
    const hiddenD = container.querySelector('[data-testid="deck-node"][data-node-id="d"]');
    expect(hiddenD).toHaveAttribute('aria-hidden', 'true');
    expect(hiddenD).toHaveAttribute('inert');
    act(() => {
      ui().select({ nodes: ['c'] });
    });
    const hiddenA = container.querySelector('[data-testid="deck-node"][data-node-id="a"]');
    expect(hiddenA).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('group', { name: 'Database: B' })).not.toHaveAttribute('aria-hidden');
    expect(screen.getByRole('group', { name: 'Queue: C' })).not.toHaveAttribute('aria-hidden');
    expect(screen.getByRole('group', { name: 'Client: D' })).not.toHaveAttribute('aria-hidden');

    act(() => {
      (canvas as HTMLElement).focus();
    });
    await user.keyboard('f');
    expect(ui().focusMode).toBe(false);

    act(() => {
      ui().select({ nodes: ['b'] });
      ui().setFocusMode(true);
    });
    expect(canvas).toHaveAttribute('data-focus-mode');

    act(() => {
      ui().startRecording('Order flow', null);
    });
    expect(ui().focusMode).toBe(false);
    expect(canvas).not.toHaveAttribute('data-focus-mode');

    act(() => {
      ui().clearSelection();
    });
    expect(canvas).not.toHaveAttribute('data-focus-mode');
    expect(toJSON(doc)).toEqual(before);
  });
});

describe('canvas handlers', () => {
  it('selects one item by click, toggles with shift/⌘, clears on the pane', () => {
    const { h } = handlers();
    act(() => {
      h().onNodeClick(click(), flowNode('a'));
    });
    expect(ui().selection).toEqual({ nodes: ['a'], edges: [], groups: [], stickies: [] });
    expect(ui().focusedId).toBe('a');
    act(() => {
      h().onNodeClick(click({ shiftKey: true }), flowNode('b'));
      h().onEdgeClick(click({ metaKey: true }), flowEdge('e1'));
    });
    expect(ui().selection).toEqual({ nodes: ['a', 'b'], edges: ['e1'], groups: [], stickies: [] });
    act(() => {
      h().onNodeClick(click({ ctrlKey: true }), flowNode('a'));
    });
    expect(ui().selection).toEqual({ nodes: ['b'], edges: ['e1'], groups: [], stickies: [] });
    act(() => {
      h().onPaneClick();
    });
    expect(ui().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
  });

  it('routes sticky selection and drag updates separately from components', () => {
    const { h, doc } = handlers(
      deckOf({
        nodes: [{ id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } }],
        stickies: [{ id: 'st1', text: 'Note', position: { x: 40, y: 60 } }],
      }),
    );
    act(() => {
      h().onNodeClick(click(), flowNode('sticky:st1'));
    });
    expect(ui().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: ['st1'] });

    act(() => {
      h().onNodeDragStart({}, flowNode('sticky:st1'));
      h().onNodesChange([{ type: 'position', id: 'sticky:st1', position: { x: 72, y: 96 } }]);
      h().onNodeDragStop();
    });
    expect(toJSON(doc).stickies[0]?.position).toEqual({ x: 72, y: 96 });
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
    expect(ui().selection).toEqual({ nodes: ['a', 'c'], edges: ['e1'], groups: [], stickies: [] });
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

  describe('drags go through the current view (011 FR-020, FR-021)', () => {
    const drag = (
      h: ReturnType<typeof handlers>['h'],
      id: string,
      to: { x: number; y: number },
    ) => {
      act(() => {
        h().onNodeDragStart({}, flowNode(id));
        h().onNodesChange([
          { type: 'position', id, position: { x: to.x - 5, y: to.y }, dragging: true },
        ]);
        h().onNodesChange([{ type: 'position', id, position: to, dragging: true }]);
        h().onNodeDragStop();
      });
    };

    it('writes the base position in the base view, one undo step', () => {
      const { h, doc, editor } = handlers();
      drag(h, 'a', { x: 40, y: 50 });
      expect(toJSON(doc).nodes[0]?.position).toEqual({ x: 40, y: 50 });
      expect(toJSON(doc).views).toEqual([]);
      act(() => {
        editor().undo();
      });
      expect(toJSON(doc).nodes[0]?.position).toEqual({ x: 0, y: 0 });
      expect(editor().canUndo()).toBe(false);
    });

    it('writes a view position in another view, and one undo removes it', () => {
      const { h, doc, editor } = handlers();
      act(() => {
        ui().switchView('infra');
      });
      drag(h, 'a', { x: 40, y: 50 });
      const file = toJSON(doc);
      expect(file.nodes[0]?.position).toEqual({ x: 0, y: 0 });
      expect(file.views.find((v) => v.id === 'infra')?.positions).toEqual({ a: { x: 40, y: 50 } });
      act(() => {
        editor().undo();
      });
      expect(toJSON(doc).views.find((v) => v.id === 'infra')?.positions).toBeUndefined();
      expect(editor().canUndo()).toBe(false);
    });

    it('keeps a pinned note where it is dropped in a view that moved its component', () => {
      const { h, doc } = handlers(
        deckOf({
          nodes: [{ id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } }],
          stickies: [{ id: 'st', text: 'Note', anchor: 'a', position: { x: 10, y: -20 } }],
          views: [
            { id: 'base', type: 'system', title: 'Base' },
            { id: 'moved', type: 'custom', title: 'Moved', positions: { a: { x: 500, y: 0 } } },
          ],
        }),
      );
      act(() => {
        ui().switchView('moved');
        h().onNodesChange([{ type: 'position', id: 'sticky:st', position: { x: 530, y: -40 } }]);
      });
      // Offset from where A is drawn in this view (500, 0).
      expect(toJSON(doc).stickies[0]?.position).toEqual({ x: 30, y: -40 });
    });
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
    expect(ui().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
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

  it('asks to expand a merged edge before recording it', () => {
    const { h } = handlers(collapsedGroupsDeck);
    act(() => {
      ui().startRecording('Place order', null);
      h().onEdgeClick(click(), flowEdge('merged:collapsed:left|collapsed:right'));
    });
    expect(ui().announcement.text).toBe('Expand the group to record this step');
    expect(ui().focusedEdgeId).toBeNull();
  });
});

describe('canvas in flow mode (007)', () => {
  const open = (editor: () => DeckEditor, stepId?: string) => {
    act(() => {
      openFlow(editor(), 'order', stepId);
    });
  };

  it('marks the wrapper while a flow is open and draws the step player', () => {
    const { editor, container } = renderWithEditor(<Canvas />, playbackDeck);
    const wrapper = () => container.querySelector('[data-canvas]');
    expect(wrapper()).not.toHaveAttribute('data-flow-mode');
    open(editor);
    expect(wrapper()).toHaveAttribute('data-flow-mode');
    expect(screen.getByRole('region', { name: 'Step player' })).toBeInTheDocument();
    // jsdom has no layout, so React Flow draws nodes but not edges: check the step's nodes.
    expect(
      container.querySelectorAll('[data-testid="deck-node"][aria-current="step"]'),
    ).toHaveLength(2);
    act(() => {
      exitFlow();
    });
    expect(wrapper()).not.toHaveAttribute('data-flow-mode');
    expect(screen.queryByRole('region', { name: 'Step player' })).not.toBeInTheDocument();
  });

  it('refuses drags, drops, connections, reconnects and edge popovers', () => {
    const { h, doc, editor } = handlers(playbackDeck);
    open(editor);
    const before = toJSON(doc);
    const drop = {
      clientX: 0,
      clientY: 0,
      preventDefault: () => undefined,
      dataTransfer: { types: [KIND_MIME], getData: () => 'service', dropEffect: '' },
    } as unknown as DragEvent;
    act(() => {
      h().onDragOver(drop);
      h().onDrop(drop);
      h().onNodeDragStart(undefined, flowNode('a'));
      h().onNodesChange([
        { id: 'a', type: 'position', position: { x: 999, y: 999 } },
      ] as NodeChange[]);
      h().onNodeDragStop();
      h().onConnect({ source: 'a', target: 'z', sourceHandle: null, targetHandle: null });
      h().onReconnect(flowEdge('ab'), {
        source: 'a',
        target: 'z',
        sourceHandle: null,
        targetHandle: null,
      });
      h().onEdgeDoubleClick(click(), flowEdge('ab'));
    });
    expect(toJSON(doc)).toEqual(before);
    expect(editor().canUndo()).toBe(false);
    expect(ui().popover).toBeNull();
    expect(ui().activeFlow?.flowId).toBe('order');
  });

  it('jumps to the first step touching a clicked member node', () => {
    const { h, editor } = handlers(playbackDeck);
    open(editor, 'o6');
    act(() => {
      h().onNodeClick(click(), flowNode('c'));
    });
    expect(ui().activeFlow?.stepId).toBe('o2');
    expect(ui().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
  });

  it('cycles through the steps of an edge used twice, wrapping around', () => {
    const { h, editor } = handlers(playbackDeck);
    open(editor, 'o3');
    act(() => {
      h().onEdgeClick(click(), flowEdge('bc'));
    });
    expect(ui().activeFlow?.stepId).toBe('o4');
    act(() => {
      h().onEdgeClick(click(), flowEdge('bc'));
    });
    expect(ui().activeFlow?.stepId).toBe('o2');
  });

  it('ignores dimmed nodes and edges and the pane, staying in flow mode', () => {
    const { h, editor } = handlers(playbackDeck);
    open(editor, 'o3');
    const seq = ui().announcement.seq;
    act(() => {
      h().onNodeClick(click(), flowNode('z'));
      h().onEdgeClick(click(), flowEdge('az'));
      h().onPaneClick();
    });
    expect(ui().activeFlow).toMatchObject({ flowId: 'order', stepId: 'o3' });
    expect(ui().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
    expect(ui().announcement.seq).toBe(seq);
  });

  it('pauses playback and announces once on a jump', () => {
    const { h, editor } = handlers(playbackDeck);
    open(editor, 'o1');
    act(() => {
      ui().setPlaying(true);
    });
    const seq = ui().announcement.seq;
    act(() => {
      h().onNodeClick(click(), flowNode('x'));
    });
    expect(ui().activeFlow).toMatchObject({ stepId: 'o5', playing: false });
    expect(ui().announcement.seq).toBe(seq + 1);
  });

  it('jumps to the first hidden step from a collapsed card and cycles a merged edge', () => {
    const { h, editor } = handlers(groupedPlaybackDeck);
    act(() => {
      ui().toggleCollapsed('core');
    });
    open(editor, 'o1');

    act(() => {
      h().onNodeClick(click(), flowNode('collapsed:core'));
    });
    expect(ui().activeFlow?.stepId).toBe('o2');

    act(() => {
      h().onEdgeClick(click(), flowEdge('merged:a|collapsed:core'));
    });
    expect(ui().activeFlow?.stepId).toBe('o1');
  });

  it('keeps collapsed cards bright on the played path', () => {
    const { editor } = renderWithEditor(<Canvas />, groupedPlaybackDeck);
    act(() => {
      ui().toggleCollapsed('core');
      openFlow(editor(), 'order', 'o2');
    });

    expect(
      screen
        .getByRole('button', {
          name: 'Core services, collapsed group, 2 nodes, 2 edges, flow step inside',
        })
        .closest('.react-flow__node'),
    ).toHaveClass('in-flow');
  });

  it('goes up to the whole deck before opening a flow and announces it', () => {
    const { editor } = renderWithEditor(<Canvas />, groupedPlaybackDeck);
    act(() => {
      ui().drillInto({ kind: 'group', id: 'core', viewport: { x: 10, y: 20, zoom: 0.8 } });
      openFlow(editor(), 'order');
    });

    expect(ui().drill).toEqual([]);
    expect(ui().announcement.text).toBe('Showing the whole deck for this flow');
  });
});
