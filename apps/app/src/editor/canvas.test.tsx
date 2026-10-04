import { fromJSON, toJSON, type DeckEditor } from '@sododeck/model';
import * as Y from 'yjs';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Edge, FinalConnectionState, Node, NodeChange } from '@xyflow/react';
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { playbackDeck } from '../test/flow-fixtures';
import { deckOf, editorWrapper, renderWithEditor } from '../test/render-canvas';
import { Canvas, liplessSelector } from './canvas';
import { demoDeck } from './demo-deck';
import { exitFlow, openFlow } from './flows/flow-mode';
import { DeckIsland } from './shell/deck-island';
import { TYPE_MIME, NOTE_MIME, useCanvasHandlers } from './use-canvas-handlers';
import { addComponent } from './canvas-actions';
import { GROUP_PADDING } from './canvas-geometry';
import { frameContent } from './editing/frame-resize';
import { clampFrame } from './editing/resize-limits';
import { collapsedOf, setGroupCollapsed, toggleGroupCollapsed } from './views/use-current-view';
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
      <DeckIsland deck={deck} />
      <Canvas />
    </MemoryRouter>
  );
}

describe('Canvas', () => {
  it('renders every component and the canvas region', () => {
    renderWithEditor(<Canvas />, deck);
    expect(screen.getByLabelText('Diagram canvas')).toBeInTheDocument();
    expect(screen.getAllByTestId('deck-node')).toHaveLength(4);
    // The minimap is off until toggled (018 FR-033).
    expect(screen.queryByLabelText('Minimap')).not.toBeInTheDocument();
    act(() => {
      useUiStore.getState().setMinimap(true);
    });
    expect(screen.getByLabelText('Minimap')).toBeInTheDocument();
  });

  describe('hover focus (034, only in Focus mode since 051)', () => {
    const lit = (container: HTMLElement) => container.querySelector('style')?.textContent ?? '';
    const rest = () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));
      });

    it('lights nothing and dims nothing outside Focus mode (051 C1)', async () => {
      const { container } = renderWithEditor(<Canvas />, deck);
      const root = screen.getByLabelText('Diagram canvas').closest('[data-region="canvas"]');
      const target = container.querySelector('.react-flow__node[data-id="b"]');
      if (target === null) throw new Error('no node b');
      fireEvent.mouseEnter(target);
      await rest();
      expect(ui().hoverFocus).toBeNull();
      expect(root).not.toHaveAttribute('data-hover-focus');
      act(() => {
        ui().select({ nodes: ['b'] });
      });
      expect(container.querySelector('[data-canvas]')).not.toHaveAttribute('data-focus-mode');
      expect(container.querySelector('[aria-hidden="true"][data-testid="deck-node"]')).toBeNull();
      act(() => {
        ui().focus('a');
        document.querySelector<HTMLElement>('[data-node-id="a"]')?.focus();
      });
      expect(root).not.toHaveAttribute('data-hover-focus');
    });

    it('lights a resting card, its neighbours and connectors without changing any object', async () => {
      const before = structuredClone(deck);
      const { container, doc, editor } = renderWithEditor(<Canvas />, deck);
      act(() => {
        ui().setFocusMode(true);
      });
      const root = screen.getByLabelText('Diagram canvas').closest('[data-region="canvas"]');
      const wrapperNode = container.querySelector('.react-flow__node[data-id="b"]');
      expect(wrapperNode).not.toBeNull();
      if (wrapperNode === null) return;
      fireEvent.mouseEnter(wrapperNode);
      expect(root).not.toHaveAttribute('data-hover-focus');
      await waitFor(() => {
        expect(root).toHaveAttribute('data-hover-focus');
      });
      // b touches a (e1) and c (e2): d and e3 are dimmed, and nothing is inert or hidden.
      expect(lit(container)).toContain('[data-id="e1"], [data-id="e2"]');
      expect(lit(container)).not.toMatch(/inert|aria-hidden/);
      expect(screen.getAllByTestId('deck-node')).toHaveLength(4);
      expect(container.querySelector('[inert]')).toBeNull();
      fireEvent.mouseLeave(wrapperNode);
      await waitFor(() => {
        expect(root).not.toHaveAttribute('data-hover-focus');
      });
      // Fanning a bundle and drilling in are UI state as well: the saved deck is byte-identical.
      const serialised = JSON.stringify(toJSON(doc));
      act(() => {
        ui().toggleBundleFan('bundle:a|b');
        ui().drillInto({ kind: 'node', id: 'a', viewport: { x: 0, y: 0, zoom: 1 } });
      });
      expect(JSON.stringify(toJSON(doc))).toBe(serialised);
      expect(toJSON(doc)).toEqual(before);
      expect(editor().canUndo()).toBe(false);
    });

    it('treats an outside proxy as a neighbour inside a drill-in (US3.6)', async () => {
      const drilled = deckOf({
        nodes: [
          { id: 'in', type: 'service', title: 'In', group: 'core', position: { x: 0, y: 0 } },
          { id: 'far', type: 'service', title: 'Far', group: 'core', position: { x: 0, y: 300 } },
          { id: 'out', type: 'service', title: 'Out', position: { x: 900, y: 0 } },
        ],
        groups: [{ id: 'core', title: 'Core' }],
        edges: [{ id: 'e', from: 'in', to: 'out' }],
      });
      const { container } = renderWithEditor(<Canvas />, drilled);
      act(() => {
        ui().drillInto({ kind: 'group', id: 'core', viewport: { x: 0, y: 0, zoom: 1 } });
        ui().setFocusMode(true);
      });
      const target = container.querySelector('.react-flow__node[data-id="in"]');
      if (target === null) throw new Error('no node in');
      fireEvent.mouseEnter(target);
      await waitFor(() => {
        expect(ui().hoverFocus?.id).toBe('in');
      });
      const text = lit(container);
      expect(text).toContain(CSS.escape('port:out'));
    });

    it('lights a keyboard-focused card at once and announces its connections', async () => {
      const user = userEvent.setup();
      const { container } = renderWithEditor(<Canvas />, deck);
      const root = screen.getByLabelText('Diagram canvas').closest('[data-region="canvas"]');
      act(() => {
        ui().setFocusMode(true);
      });
      act(() => {
        ui().focus('a');
        document.querySelector<HTMLElement>('[data-node-id="a"]')?.focus();
      });
      expect(root).toHaveAttribute('data-hover-focus');
      expect(ui().hoverFocus?.source).toBe('keyboard');
      expect(lit(container)).toContain('[data-id="e1"]');
      // Arrows select the next card, and a selection pins the focus instead (051 C1).
      await user.keyboard('{ArrowRight}');
      expect(ui().selection.nodes).toEqual(['b']);
      expect(ui().hoverFocus).toBeNull();
      expect(container.querySelector('[data-canvas]')).toHaveAttribute('data-focus-mode');
    });

    it('does not light anything while pinned focus is on', async () => {
      const { container } = renderWithEditor(<Canvas />, deck);
      const root = screen.getByLabelText('Diagram canvas').closest('[data-region="canvas"]');
      act(() => {
        ui().select({ nodes: ['a'] });
        ui().setFocusMode(true);
      });
      const target = container.querySelector('.react-flow__node[data-id="b"]');
      if (target === null) throw new Error('no node b');
      fireEvent.mouseEnter(target);
      await rest();
      expect(ui().hoverFocus).toBeNull();
      expect(root).not.toHaveAttribute('data-hover-focus');
      // Emptying the selection keeps Focus mode on, and hover drives it again (051 C1).
      act(() => {
        ui().clearSelection();
      });
      expect(ui().focusMode).toBe(true);
      fireEvent.mouseLeave(target);
      fireEvent.mouseEnter(target);
      await waitFor(() => {
        expect(root).toHaveAttribute('data-hover-focus');
      });
    });
  });

  it('colours a minimap node by its fill (020 T056)', () => {
    const coloured = deckOf({
      nodes: [{ id: 'x', type: 'service', title: 'X', style: { fill: 'green' } }],
    });
    const { container } = renderWithEditor(<Canvas />, coloured);
    act(() => {
      useUiStore.getState().setMinimap(true);
    });
    const rect = container.querySelector('.react-flow__minimap-node');
    expect(rect).toHaveStyle({
      fill: 'var(--color-card-green-fill)',
      stroke: 'var(--color-border-strong)',
    });
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
    await user.click(screen.getByRole('button', { name: 'Add component' }));
    expect(ui().flyout).toBe('palette');
    act(() => {
      editor().add('nodes', { type: 'service', title: 'S' });
    });
    expect(screen.queryByRole('heading', { name: 'Start your diagram' })).not.toBeInTheDocument();
  });

  it('hides the empty-canvas card once a frame is drawn, even with no cards (031)', () => {
    const { editor } = renderWithEditor(<Canvas />, deckOf({}));
    expect(screen.getByRole('heading', { name: 'Start your diagram' })).toBeInTheDocument();
    act(() => {
      editor().groupSelection({
        nodes: [],
        groups: [],
        title: 'Payments',
        frame: { position: { x: 0, y: 0 }, size: { width: 320, height: 200 } },
      });
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
    fireEvent.dragOver(canvas, data([TYPE_MIME]));
    fireEvent.drop(canvas, data([TYPE_MIME], 'database'));
    const [node] = toJSON(doc).nodes;
    expect(node).toMatchObject({ type: 'database', title: 'Untitled database' });
    expect(ui().selection.nodes).toEqual([node?.id]);
    expect(ui().announcement.text).toBe('Added Untitled database');
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
      dataTransfer: { types: [TYPE_MIME], getData: () => 'service', dropEffect: '' },
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
    // Now the node carries the Tab stop (plus its four handles and its details button, 019);
    // the canvas itself does not.
    expect(canvas).toHaveAttribute('tabindex', '-1');
    expect(tabStops()).toEqual([
      nodeA,
      ...screen.getAllByRole('button', { name: 'Connect from A' }),
      screen.getByRole('button', { name: 'Open details for A' }),
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

    // Double-click renames a frame in place (it no longer drills in); Enter drills in.
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Core services group, 2 nodes' }));
    expect(ui().drill).toEqual([]);
    expect(ui().titleEdit).toMatchObject({ target: 'group', id: 'core' });
    expect(screen.getByRole('textbox', { name: 'Group title' })).toHaveValue('Core services');
    await user.keyboard('{Escape}');
    expect(ui().titleEdit).toBeNull();
    act(() => {
      ui().focus('group:core');
      document.querySelector<HTMLElement>('[data-node-id="group:core"]')?.focus();
    });
    await user.keyboard('{Enter}');
    expect(ui().drill.map((frame) => frame.id)).toEqual(['core']);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      'System view/Core services',
    );
    expect(screen.getAllByTestId('deck-node')).toHaveLength(2);
    expect(screen.queryByRole('group', { name: 'Service: Gateway' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gateway, outside/ })).toBeInTheDocument();
    expect(screen.getByText('Inside Core services')).toBeInTheDocument();

    // A click only focuses the proxy; double-click leaves the drill-in for the real card.
    await user.click(screen.getByRole('button', { name: /Gateway, outside/ }));
    expect(ui().drill).toHaveLength(1);
    await user.dblClick(screen.getByRole('button', { name: /Gateway, outside/ }));
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

    // Double-click renames a component with children (019 FR-001); Enter drills in.
    const parent = await screen.findByRole('group', { name: 'Service: Delivery platform' });
    fireEvent.doubleClick(parent);
    expect(ui().drill).toEqual([]);
    expect(ui().titleEdit).toEqual({ target: 'node', id: 'parent', isNew: false });
    await user.keyboard('{Escape}');
    expect(ui().titleEdit).toBeNull();
    expect(parent).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(ui().drill.map((frame) => frame.id)).toEqual(['parent']);
    expect(screen.getAllByTestId('deck-node')).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Service: Dispatch' })).toBeInTheDocument();
    expect(toJSON(doc)).toEqual(before);
    expect(editor().canUndo()).toBe(false);
  });

  it('collapses a group from the keyboard, renders merged edges, and updates counts live', async () => {
    const user = userEvent.setup();
    const before = structuredClone(collapsedGroupsDeck);
    const { doc, unmount, editor } = renderWithEditor(<Canvas />, collapsedGroupsDeck);

    act(() => {
      ui().focus('group:left');
      ui().select({ groups: ['left'] });
      document.querySelector<HTMLElement>('[data-node-id="group:left"]')?.focus();
    });
    await user.keyboard(' ');
    expect(collapsedOf(doc).has('left')).toBe(true);
    expect(ui().focusedId).toBe('collapsed:left');
    expect(screen.getByTestId('collapsed-group-node')).toHaveAccessibleName(
      'Left, collapsed group, 2 nodes, 0 edges',
    );

    // 011: collapse is saved in the current view, never on the group, and never an undo step.
    expect(toJSON(doc).groups).toEqual(before.groups);
    expect(toJSON(doc).views[0]?.collapsed).toEqual(['left']);
    expect(editor().canUndo()).toBe(false);

    unmount();
    const merged = renderWithEditor(<Canvas />, collapsedGroupsDeck);
    const collapse = (id: string, on: boolean) => setGroupCollapsed(merged.editor(), id, on);
    act(() => {
      collapse('left', true);
      collapse('right', true);
    });
    expect(collapsedOf(merged.doc).has('right')).toBe(true);

    act(() => {
      collapse('right', false);
    });
    expect(collapsedOf(merged.doc).has('right')).toBe(false);

    act(() => {
      collapse('right', true);
      merged.editor().add('nodes', { type: 'service', title: 'A3', group: 'left' });
    });
    expect(
      screen.getByRole('button', {
        name: 'Left, collapsed group, 3 nodes, 0 edges',
      }),
    ).toBeInTheDocument();
  });

  it('replaces hidden selections with the collapsed group and clears them when drill hides them', () => {
    const { editor } = renderWithEditor(<Canvas />, collapsedGroupsDeck);

    act(() => {
      ui().select({ nodes: ['a1'], edges: ['m0'] });
      setGroupCollapsed(editor(), 'left', true);
    });
    expect(ui().selection).toEqual({ nodes: [], edges: [], groups: ['left'], stickies: [] });

    act(() => {
      setGroupCollapsed(editor(), 'left', false);
      ui().select({ nodes: ['a1'] });
    });
    act(() => {
      ui().drillInto({ kind: 'group', id: 'left', viewport: { x: 0, y: 0, zoom: 1 } });
    });
    expect(ui().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
  });

  it('flags the wrapper for the details button: drag, session, Hide UI, tiny cards (019 R4)', () => {
    const { container } = renderWithEditor(<Canvas />, deck);
    const canvas = container.querySelector('[data-canvas]');
    for (const flag of ['data-dragging', 'data-hide-ui', 'data-flow-session']) {
      expect(canvas).not.toHaveAttribute(flag);
    }
    act(() => {
      ui().setCanvasGesture('drag');
      ui().setHideUi(true);
      ui().startRecording('New flow', null);
    });
    for (const flag of ['data-dragging', 'data-hide-ui', 'data-flow-session']) {
      expect(canvas).toHaveAttribute(flag);
    }
    // jsdom's React Flow starts at zoom 1: a 164 px card is not tiny.
    expect(canvas).not.toHaveAttribute('data-tiny-cards');
  });

  it('flags the wrapper data-lipless below 60 % zoom and not at 60 % (029 R8)', () => {
    const at = (zoom: number) => liplessSelector({ transform: [0, 0, zoom] });
    expect(at(0.59)).toBe(true);
    expect(at(0.3)).toBe(true);
    expect(at(0.6)).toBe(false);
    expect(at(1)).toBe(false);
    // jsdom's React Flow starts at zoom 1: the wrapper has no flag.
    const { container } = renderWithEditor(<Canvas />, deck);
    expect(container.querySelector('[data-canvas]')).not.toHaveAttribute('data-lipless');
  });

  it('does not hand focus to a card when the canvas is pressed with the pointer', () => {
    const { container } = renderWithEditor(<Canvas />, deck);
    const canvas = container.querySelector<HTMLElement>('[data-canvas]');
    if (canvas === null) throw new Error('no canvas');
    // A press on empty canvas focuses the wrapper; jumping to the first card would pan away.
    fireEvent.pointerDown(canvas);
    act(() => {
      canvas.focus();
    });
    expect(ui().focusedId).toBeNull();
  });

  it('drags a marquee with Select and pans with Hand (§g-57)', () => {
    const { container } = renderWithEditor(<Canvas />, deck);
    const pane = () => container.querySelector('.react-flow__pane');
    // Select: an arrow cursor (React Flow's grab cursor comes with its `draggable` class).
    expect(ui().tool).toBe('select');
    expect(pane()).not.toHaveClass('draggable');
    act(() => {
      ui().setTool('hand');
    });
    expect(pane()).toHaveClass('draggable');
    act(() => {
      ui().setTool('select');
    });
    expect(pane()).not.toHaveClass('draggable');
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

  it('keeps Focus mode on when the selection empties, with nothing dimmed (051 C1)', () => {
    const { container } = renderWithEditor(<Canvas />, deck);
    act(() => {
      ui().select({ nodes: ['b'] });
      ui().setFocusMode(true);
    });
    const canvas = container.querySelector('[data-canvas]');
    expect(canvas).toHaveAttribute('data-focus-mode');
    act(() => {
      ui().clearSelection();
    });
    expect(ui().focusMode).toBe(true);
    expect(canvas).not.toHaveAttribute('data-focus-mode');
    expect(container.querySelector('[aria-hidden="true"][data-testid="deck-node"]')).toBeNull();
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
      h().onPaneClick(click());
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

  describe('⌥-drag duplicates (016 FR-009)', () => {
    it('puts the originals back and drops a copy, as one undo step', () => {
      const { h, doc, editor } = handlers();
      act(() => {
        ui().select({ nodes: ['a', 'b'] });
      });
      act(() => {
        h().onNodeDragStart({}, flowNode('a'));
        // ⌥ is held while dragging: the copy appears during the drag (051 US2).
        h().onNodeDrag(click({ altKey: true, clientX: 0, clientY: 0 }));
        h().onNodesChange([
          { type: 'position', id: 'a', position: { x: 2000, y: 1400 }, dragging: true },
          { type: 'position', id: 'b', position: { x: 2300, y: 1400 }, dragging: true },
        ]);
        h().onNodeDragStop(click({ altKey: true }));
      });
      const file = toJSON(doc);
      expect(file.nodes.slice(0, 2).map((n) => n.position)).toEqual([
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ]);
      const copies = file.nodes.slice(4);
      expect(copies.map((n) => n.position)).toEqual([
        { x: 2000, y: 1400 },
        { x: 2300, y: 1400 },
      ]);
      expect(ui().selection.nodes).toEqual(copies.map((n) => n.id));
      expect(ui().announcement.text).toBe('Duplicated 2 components');
      act(() => {
        editor().undo();
      });
      expect(toJSON(doc).nodes).toHaveLength(4);
      expect(toJSON(doc).nodes[0]?.position).toEqual({ x: 0, y: 0 });
      expect(editor().canUndo()).toBe(false);
    });

    it('lifts the copy, not the original, while duplicating (051 C2)', () => {
      const { container } = renderWithEditor(<Canvas />, deck);
      const wrapper = container.querySelector('[data-canvas]');
      expect(wrapper).not.toHaveAttribute('data-duplicating');
      act(() => {
        ui().setDragCopyIds(['b']);
      });
      expect(wrapper).toHaveAttribute('data-duplicating');
      expect(container.querySelector('.react-flow__node[data-id="b"]')).toHaveClass('sd-drag-copy');
      expect(container.querySelector('.react-flow__node[data-id="a"]')).not.toHaveClass(
        'sd-drag-copy',
      );
      act(() => {
        ui().clearDragCopyIds();
      });
      expect(wrapper).not.toHaveAttribute('data-duplicating');
      expect(container.querySelector('.react-flow__node[data-id="b"]')).not.toHaveClass(
        'sd-drag-copy',
      );
    });

    it('moves as usual without ⌥', () => {
      const { h, doc } = handlers();
      act(() => {
        h().onNodeDragStart({}, flowNode('a'));
        h().onNodesChange([
          { type: 'position', id: 'a', position: { x: 2000, y: 1400 }, dragging: true },
        ]);
        h().onNodeDragStop(click());
      });
      expect(toJSON(doc).nodes).toHaveLength(4);
      expect(toJSON(doc).nodes[0]?.position).toEqual({ x: 2000, y: 1400 });
    });
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

    it('moves a pinned component and keeps it pinned (FR-024)', () => {
      const { h, doc } = handlers(
        deckOf({ ...deck, views: [{ id: 'v', type: 'system', title: 'V', pinned: ['a'] }] }),
      );
      drag(h, 'a', { x: 40, y: 50 });
      expect(toJSON(doc).nodes[0]?.position).toEqual({ x: 40, y: 50 });
      expect(toJSON(doc).views[0]?.pinned).toEqual(['a']);
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
    // A drop on d's body: React Flow reports a valid connection; the drop makes it (050 T021).
    const dropOn = (from: string, to: string) =>
      ({
        isValid: true,
        fromNode: { id: from },
        fromHandle: { id: 'right', type: 'source' },
        toNode: { id: to },
      }) as unknown as FinalConnectionState;
    act(() => {
      h().onConnectEnd({ clientX: 0, clientY: 0 } as MouseEvent, dropOn('a', 'd'));
    });
    const edge = toJSON(doc).edges.at(-1);
    expect(edge).toMatchObject({ from: 'a', to: 'd' });
    expect(ui().selection.edges).toEqual([edge?.id]);
    expect(ui().popover).toEqual({ kind: 'edge', edgeId: edge?.id });
    expect(ui().announcement.text).toBe('Connected A to D');
    // A duplicate reaching the drop anyway is still refused.
    act(() => {
      h().onConnectEnd({ clientX: 0, clientY: 0 } as MouseEvent, dropOn('d', 'a'));
    });
    expect(toJSON(doc).edges).toHaveLength(4);
  });

  it('double-click renames a group frame in place and expands a collapsed group', () => {
    const { h, doc, editor } = handlers(collapsedGroupsDeck);
    act(() => {
      h().onNodeDoubleClick(click(), flowNode('group:left'));
    });
    expect(ui().drill).toEqual([]);
    expect(ui().titleEdit).toEqual({ target: 'group', id: 'left', isNew: false });
    expect(ui().selection.groups).toEqual(['left']);
    act(() => {
      ui().endTitleEdit();
      setGroupCollapsed(editor(), 'right', true);
    });
    act(() => {
      h().onNodeDoubleClick(click(), flowNode('collapsed:right'));
    });
    expect(collapsedOf(doc).has('right')).toBe(false);
    expect(ui().drill).toEqual([]);
    expect(ui().focusedId).toBe('group:right');
    expect(ui().announcement.text).toBe('Right expanded');
  });

  it('opens the popover on double-click of an edge', () => {
    const { h } = handlers();
    act(() => {
      h().onEdgeDoubleClick(click(), flowEdge('e2'));
    });
    expect(ui().popover).toEqual({ kind: 'edge', edgeId: 'e2' });
    expect(ui().selection.edges).toEqual(['e2']);
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
      dataTransfer: { types: [TYPE_MIME], getData: () => 'service', dropEffect: '' },
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
    // The current card is the step's target only (035): the source is a played card.
    expect(
      container.querySelectorAll('[data-testid="deck-node"][aria-current="step"]'),
    ).toHaveLength(1);
    act(() => {
      exitFlow();
    });
    expect(wrapper()).not.toHaveAttribute('data-flow-mode');
    expect(screen.queryByRole('region', { name: 'Step player' })).not.toBeInTheDocument();
  });

  it('deals the deck: a sticker per card on the path, one lifted current card (035)', () => {
    const { editor, container } = renderWithEditor(<Canvas />, playbackDeck);
    // Step 2 of "Place order" is API Gateway → Order Service (b → c).
    open(editor, 'o2');
    const stickers = () => {
      const marks: Record<string, string | null> = {};
      for (const card of container.querySelectorAll('[data-testid="deck-node"]')) {
        const sticker = card.querySelector('[data-testid="step-sticker"]');
        const text = sticker?.textContent ?? '';
        marks[card.getAttribute('data-node-id') ?? ''] =
          sticker === null
            ? null
            : `${sticker.getAttribute('data-step-state') ?? ''}:${text === '' ? '✓' : text}`;
      }
      return marks;
    };
    expect(stickers()).toEqual({
      a: 'played:✓',
      b: 'played:✓',
      c: 'current:2',
      d: 'upcoming:7',
      x: 'upcoming:5',
      n: 'upcoming:8',
      z: null,
    });
    // Off the path nothing is dealt, and only one card is lifted and current.
    expect(container.querySelectorAll('.sd-card.current-step')).toHaveLength(1);
    // The marks do not depend on the zoom: below 60 % only the CSS drops the lips.
    container.querySelector('[data-canvas]')?.setAttribute('data-lipless', '');
    expect(container.querySelectorAll('[data-testid="step-sticker"]')).toHaveLength(6);
    act(() => {
      openFlow(editor(), 'order', 'o3');
    });
    expect(stickers()).toMatchObject({ b: 'current:3', c: 'played:✓', x: 'upcoming:5' });
    act(() => {
      exitFlow();
    });
    expect(container.querySelectorAll('[data-testid="step-sticker"]')).toHaveLength(0);
    expect(container.querySelectorAll('.sd-card.current-step')).toHaveLength(0);
  });

  it('refuses drags, drops, connections and edge popovers', () => {
    const { h, doc, editor } = handlers(playbackDeck);
    open(editor);
    const before = toJSON(doc);
    const drop = {
      clientX: 0,
      clientY: 0,
      preventDefault: () => undefined,
      dataTransfer: { types: [TYPE_MIME], getData: () => 'service', dropEffect: '' },
    } as unknown as DragEvent;
    act(() => {
      h().onDragOver(drop);
      h().onDrop(drop);
      h().onNodeDragStart(undefined, flowNode('a'));
      h().onNodesChange([
        { id: 'a', type: 'position', position: { x: 999, y: 999 } },
      ] as NodeChange[]);
      h().onNodeDragStop();
      h().onConnectEnd(
        { clientX: 0, clientY: 0 } as MouseEvent,
        {
          isValid: true,
          fromNode: { id: 'a' },
          fromHandle: { id: 'right', type: 'source' },
          toNode: { id: 'z' },
        } as unknown as FinalConnectionState,
      );
      h().onConnectEnd(
        { clientX: 0, clientY: 0 } as MouseEvent,
        {
          isValid: false,
          fromNode: { id: 'a' },
        } as unknown as FinalConnectionState,
      );
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
      h().onPaneClick(click());
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
      toggleGroupCollapsed(editor(), 'core');
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
      toggleGroupCollapsed(editor(), 'core');
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

  describe('views on the canvas (011 US1)', () => {
    it('dims clients in Infra with a non-colour cue, and not in System', () => {
      renderWithEditor(<Canvas />, deck);
      expect(screen.getByRole('group', { name: 'Client: D' })).toBeInTheDocument();
      act(() => {
        ui().switchView('infra');
      });
      expect(
        screen.getByRole('group', { name: 'Client: D, dimmed in this view' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Service: A' })).toBeInTheDocument();
    });

    it('shows an edit made in Infra in System too (FR-015)', () => {
      const { editor } = renderWithEditor(<Canvas />, deck);
      act(() => {
        ui().switchView('infra');
        editor().update('nodes', 'a', { title: 'Orders API' });
        ui().switchView('system');
      });
      expect(screen.getByRole('group', { name: 'Service: Orders API' })).toBeInTheDocument();
    });

    it('hides a component excluded by the view, with its connections', () => {
      renderWithEditor(
        <Canvas />,
        deckOf({
          ...deck,
          views: [{ id: 'v', type: 'custom', title: 'V', excludeKinds: ['queue'] }],
        }),
      );
      expect(screen.queryByRole('group', { name: 'Queue: C' })).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Service: A' })).toBeInTheDocument();
    });

    it('switches to the view on the left when the current one disappears', () => {
      const { editor } = renderWithEditor(
        <Canvas />,
        deckOf({
          ...deck,
          views: [
            { id: 'one', type: 'system', title: 'One' },
            { id: 'two', type: 'custom', title: 'Two' },
            { id: 'three', type: 'custom', title: 'Three' },
          ],
        }),
      );
      act(() => {
        ui().switchView('three');
      });
      act(() => {
        editor().removeView('three');
      });
      expect(ui().currentViewId).toBe('two');
      expect(ui().announcement.text).toBe('Two view');
    });
  });

  describe('each view keeps its own layout (011 US2)', () => {
    const nodeIn = (doc: Parameters<typeof toJSON>[0], id: string) =>
      toJSON(doc).nodes.find((n) => n.id === id);
    const flowNodeAt = (id: string) =>
      document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)?.style.transform;

    it('a move in Infra leaves System alone; a node never moved in Infra sits at its base', () => {
      const { editor } = renderWithEditor(<Canvas />, deck);
      act(() => {
        ui().switchView('infra');
        editor().moveInView('infra', { a: { x: 900, y: 40 } });
      });
      expect(flowNodeAt('a')).toContain('900px');
      expect(flowNodeAt('b')).toContain('300px');
      act(() => {
        ui().switchView('system');
      });
      expect(flowNodeAt('a')).toBe('translate(0px,0px)');
    });

    it('a move in System moves the node in Feature, which has no own position', () => {
      const { editor, doc } = renderWithEditor(<Canvas />, deck);
      act(() => {
        editor().moveInView('system', { b: { x: 350, y: 60 } });
        ui().switchView('feature');
      });
      expect(nodeIn(doc, 'b')?.position).toEqual({ x: 350, y: 60 });
      expect(flowNodeAt('b')).toContain('350px');
    });

    it('keeps every view position after a reload from the saved file', () => {
      const first = renderWithEditor(<Canvas />, deck);
      act(() => {
        first.editor().moveInView('infra', { a: { x: 900, y: 40 } });
        first.editor().moveInView('system', { c: { x: 10, y: 400 } });
      });
      const saved = toJSON(first.doc);
      first.unmount();
      renderWithEditor(<Canvas />, saved);
      expect(flowNodeAt('c')).toContain('400px');
      act(() => {
        ui().switchView('infra');
      });
      expect(flowNodeAt('a')).toContain('900px');
      expect(flowNodeAt('c')).toContain('400px');
    });

    it('explains an undo of a move made in another view, with "Go to" (FR-045)', async () => {
      const user = userEvent.setup();
      const { editor } = renderWithEditor(<Canvas />, deck);
      act(() => {
        ui().switchView('infra');
        editor().moveInView('infra', { a: { x: 900, y: 40 } });
        ui().switchView('system');
      });
      act(() => {
        editor().undo();
      });
      expect(ui().currentViewId).toBe('system');
      expect(ui().announcement.text).toBe('Undid move in Infra');
      expect(screen.getByText('Undid move in Infra')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Go to Infra' }));
      expect(ui().currentViewId).toBe('infra');
    });

    it('says nothing extra for an undo in the current view', () => {
      const { editor } = renderWithEditor(<Canvas />, deck);
      act(() => {
        ui().switchView('infra');
        editor().moveInView('infra', { a: { x: 900, y: 40 } });
      });
      act(() => {
        editor().undo();
      });
      expect(screen.queryByText(/Undid move/)).not.toBeInTheDocument();
    });
  });

  it('keeps a component created in a view that hides it until the view is left (011)', () => {
    const { editor } = renderWithEditor(
      <Canvas />,
      deckOf({
        ...deck,
        views: [
          { id: 'v', type: 'custom', title: 'No services', excludeKinds: ['service'] },
          { id: 'w', type: 'custom', title: 'All' },
        ],
      }),
    );
    expect(screen.queryByRole('group', { name: 'Service: A' })).not.toBeInTheDocument();
    act(() => {
      addComponent(editor(), 'service', { x: 600, y: 600 });
    });
    const created = screen.getByRole('group', { name: 'Service: Untitled service' });
    expect(within(created).getByRole('note')).toHaveTextContent('Hidden in this view');
    act(() => {
      ui().switchView('w');
      ui().switchView('v');
    });
    expect(
      screen.queryByRole('group', { name: 'Service: Untitled service' }),
    ).not.toBeInTheDocument();
  });

  describe('collapse is remembered per view (011 US5, FR-050)', () => {
    const card = (name: RegExp) => screen.queryByRole('button', { name });

    it('keeps each view’s own collapse state, and survives a reload', () => {
      const first = renderWithEditor(<Canvas />, collapsedGroupsDeck);
      act(() => {
        setGroupCollapsed(first.editor(), 'left', true);
      });
      expect(card(/^Left, collapsed group/)).toBeInTheDocument();
      act(() => {
        ui().switchView('infra');
      });
      expect(card(/^Left, collapsed group/)).not.toBeInTheDocument();
      act(() => {
        ui().switchView('system');
      });
      expect(card(/^Left, collapsed group/)).toBeInTheDocument();

      const saved = toJSON(first.doc);
      expect(saved.views.find((v) => v.id === 'system')?.collapsed).toEqual(['left']);
      expect(saved.groups).toEqual(collapsedGroupsDeck.groups);
      first.unmount();
      renderWithEditor(<Canvas />, saved);
      expect(card(/^Left, collapsed group/)).toBeInTheDocument();
    });

    it('rename, collapse, ⌘Z: the rename is undone and the group stays collapsed', () => {
      const { editor, doc } = renderWithEditor(<Canvas />, collapsedGroupsDeck);
      act(() => {
        editor().update('nodes', 'a1', { title: 'Renamed' });
        setGroupCollapsed(editor(), 'left', true);
      });
      act(() => {
        editor().undo();
      });
      expect(toJSON(doc).nodes[0]?.title).toBe('A1');
      expect(card(/^Left, collapsed group/)).toBeInTheDocument();
      expect(editor().canUndo()).toBe(false);
    });

    it('syncs a collapse to another tab showing the same view', () => {
      const one = renderWithEditor(<Canvas />, collapsedGroupsDeck);
      const other = new Y.Doc();
      Y.applyUpdate(other, Y.encodeStateAsUpdate(one.doc));
      one.doc.on('update', (update: Uint8Array) => {
        Y.applyUpdate(other, update);
      });
      act(() => {
        setGroupCollapsed(one.editor(), 'right', true);
      });
      one.unmount();
      renderWithEditor(<Canvas />, other);
      expect(card(/^Right, collapsed group/)).toBeInTheDocument();
    });
  });
});

describe('resizing a card (017)', () => {
  const grouped = deckOf({
    nodes: [
      { id: 'a', type: 'service', title: 'A', group: 'g', position: { x: 0, y: 0 } },
      { id: 'b', type: 'database', title: 'B', group: 'g', position: { x: 300, y: 0 } },
    ],
    groups: [
      { id: 'g', title: 'G', position: { x: -20, y: -20 }, size: { width: 400, height: 200 } },
    ],
  });

  it('never changes a group frame when a member is resized, even if it overhangs (FR-010)', () => {
    const { editor, doc } = renderWithEditor(<Canvas />, grouped);
    act(() => {
      useUiStore.getState().select({ nodes: ['a'] });
    });
    act(() => {
      editor().setCardSize('a', { width: 600, height: 500 });
    });
    const group = toJSON(doc).groups.find((g) => g.id === 'g');
    // The resized card (600 x 500) is far bigger than the frame (400 x 200): it overhangs, and
    // the stored frame itself never moves or grows.
    expect(group?.position).toEqual({ x: -20, y: -20 });
    expect(group?.size).toEqual({ width: 400, height: 200 });
  });

  it('the 016 frame resize minimum grows to keep the enlarged card inside (FR-013)', () => {
    const { editor, doc } = renderWithEditor(<Canvas />, grouped);
    const before = frameContent(toJSON(doc), 'g');
    act(() => {
      editor().setCardSize('a', { width: 700, height: 600 });
    });
    const after = frameContent(toJSON(doc), 'g');
    expect(after?.width).toBeGreaterThan(before?.width ?? 0);
    expect(after?.height).toBeGreaterThan(before?.height ?? 0);
    // A frame can never be clamped smaller than its (now bigger) content plus padding.
    const shrunk = clampFrame({ x: 0, y: 0, width: 10, height: 10 }, after, GROUP_PADDING);
    expect(shrunk.width).toBeGreaterThanOrEqual((after?.width ?? 0) + 2 * GROUP_PADDING);
    expect(shrunk.height).toBeGreaterThanOrEqual((after?.height ?? 0) + 2 * GROUP_PADDING);
  });

  it('shows resize handles only for one selected card, never in flow mode or a flow session', () => {
    const { container, editor } = renderWithEditor(<Canvas />, playbackDeck);
    act(() => {
      useUiStore.getState().select({ nodes: ['a'] });
    });
    expect(container.querySelectorAll('.sd-resize-handle').length).toBeGreaterThan(0);

    act(() => {
      openFlow(editor(), 'order');
    });
    expect(container.querySelectorAll('.sd-resize-handle')).toHaveLength(0);
    act(() => {
      exitFlow();
    });
    act(() => {
      useUiStore.getState().select({ nodes: ['a'] });
    });
    expect(container.querySelectorAll('.sd-resize-handle').length).toBeGreaterThan(0);

    act(() => {
      useUiStore.getState().startRecording('Place order', null);
    });
    expect(container.querySelectorAll('.sd-resize-handle')).toHaveLength(0);
  });
});

// T038's three scenarios (segment slider shown for a stacked pair, hidden for perpendicular
// sides, flow highlight on a shifted path) live in `deck-edge.test.tsx` instead of a `<Canvas>`
// mount: React Flow never measures node size under jsdom, so edges (and anything they portal
// through `EdgeLabelRenderer`, like the segment handle) never render here — see "canvas in flow
// mode (007)" above, which hits the same limit for the step player's node-only assertions.

describe('the Deck look leaves the file alone (029 SC-001)', () => {
  it('serialises the demo deck identically before and after it is rendered', () => {
    const doc = fromJSON(demoDeck);
    const before = JSON.stringify(toJSON(doc));
    renderWithEditor(<Canvas />, doc);
    expect(screen.getAllByTestId('deck-node').length).toBeGreaterThan(0);
    // Drawing only reads the document: no default size or position is written back.
    expect(JSON.stringify(toJSON(doc))).toBe(before);
  });
});
