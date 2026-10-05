import { toJSON } from '@sododeck/model';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { readDeck } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';
import { playbackDeck } from '../test/flow-fixtures';
import { deckOf, editorWrapper } from '../test/render-canvas';
import { Canvas } from './canvas';
import { canvasElement } from './canvas-actions';
import { focusTargetId } from './focus-target';
import { openFlow } from './flows/flow-mode';
import { DetailDrawer } from './shell/detail-drawer';
import { SaveContext } from './save-context';
import { isTextTarget, useEditorShortcuts } from './use-canvas-shortcuts';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { collapsedOf, toggleGroupCollapsed } from './views/use-current-view';
import { startBendDrag } from './editing/bend-drag';
import { NUDGE_IDLE_MS } from './editing/use-nudge';

/** 3×3 grid: n00 … n22 (row, column), 300 px apart. */
const grid = deckOf({
  nodes: [0, 1, 2].flatMap((r) =>
    [0, 1, 2].map((c) => ({
      id: `n${String(r)}${String(c)}`,
      type: 'service' as const,
      title: `N${String(r)}${String(c)}`,
      position: { x: c * 300, y: r * 200 },
    })),
  ),
  edges: [
    { id: 'e1', from: 'n11', to: 'n12', label: 'right' },
    { id: 'e2', from: 'n01', to: 'n11' },
  ],
});

const stickyDeck = deckOf({
  nodes: [{ id: 'svc', type: 'service', title: 'Order Service', position: { x: 240, y: 120 } }],
  stickies: [
    { id: 'st1', text: 'Remember retries', position: { x: 40, y: 60 } },
    { id: 'st2', text: 'Pinned note', anchor: 'svc', position: { x: 12, y: -24 } },
  ],
});

const groupedDeck = deckOf({
  nodes: [
    { id: 'inside', type: 'service', title: 'Inside', group: 'core', position: { x: 100, y: 100 } },
    { id: 'outside', type: 'service', title: 'Outside', position: { x: 340, y: 100 } },
  ],
  groups: [{ id: 'core', title: 'Core' }],
  edges: [{ id: 'edge', from: 'inside', to: 'outside' }],
});

const mergedDeck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', group: 'left', position: { x: 40, y: 40 } },
    { id: 'b', type: 'service', title: 'B', group: 'right', position: { x: 420, y: 40 } },
  ],
  groups: [
    { id: 'left', title: 'Left' },
    { id: 'right', title: 'Right' },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b' },
    { id: 'e2', from: 'a', to: 'b' },
  ],
});

const groupedPlaybackDeck = deckOf({
  ...playbackDeck,
  nodes: playbackDeck.nodes.map((node) =>
    node.id === 'b' || node.id === 'c' ? { ...node, group: 'core' } : node,
  ),
  groups: [{ id: 'core', title: 'Core services' }],
});

const ui = () => useUiStore.getState();

function Editor() {
  useEditorShortcuts();
  const deck = useDeckSnapshot(useEditor().doc);
  return (
    <>
      <input aria-label="Notes" />
      <Canvas />
      <DetailDrawer deck={deck} />
    </>
  );
}

function setup(file = grid) {
  const env = editorWrapper(file);
  render(<Editor />, { wrapper: env.wrapper });
  return { ...env, user: userEvent.setup() };
}

/** Focuses a node the way the canvas does (click / roving focus). */
function focusNode(id: string) {
  act(() => {
    ui().select({ nodes: [id] });
    ui().focus(id);
  });
  const el = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
  act(() => {
    el?.focus();
  });
}

function focusSticky() {
  const [el] = screen.getAllByTestId('sticky-node');
  if (el === undefined) throw new Error('sticky note not rendered');
  act(() => {
    ui().select({ stickies: ['st1'] });
    el.focus();
  });
}

describe('canvas keyboard', () => {
  it('moves focus and selection to the nearest component with the arrows', async () => {
    const { user } = setup();
    focusNode('n11');
    await user.keyboard('{ArrowRight}');
    expect(ui().focusedId).toBe('n12');
    expect(ui().selection.nodes).toEqual(['n12']);
    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Service: N12' })).toHaveFocus();
    });
    await user.keyboard('{ArrowUp}{ArrowLeft}{ArrowLeft}');
    expect(ui().focusedId).toBe('n00');
    // Nothing further left: focus stays.
    await user.keyboard('{ArrowLeft}');
    expect(ui().focusedId).toBe('n00');
  });

  it('lets arrows reach a group label and a collapsed card', async () => {
    const { user, editor } = setup(groupedDeck);
    focusNode('inside');
    await user.keyboard('{ArrowLeft}');
    expect(ui().focusedId).toBe('group:core');
    expect(ui().selection.groups).toEqual(['core']);
    await waitFor(() => {
      expect(document.querySelector('[data-node-id="group:core"]')).toHaveFocus();
    });

    act(() => {
      toggleGroupCollapsed(editor(), 'core');
      ui().focus('outside');
      ui().select({ nodes: ['outside'] });
    });
    await user.keyboard('{ArrowLeft}');
    expect(ui().focusedId).toBe('collapsed:core');
    expect(ui().selection.groups).toEqual(['core']);
  });

  it('does not flip a group while Space is held to pan, only on a plain press (2026-10-03)', async () => {
    const { user, doc } = setup(mergedDeck);
    act(() => {
      ui().focus('group:left');
      ui().select({ groups: ['left'] });
      document.querySelector<HTMLElement>('[data-node-id="group:left"]')?.focus();
    });
    // Held: the key repeats, and a drag pans meanwhile.
    await user.keyboard('[Space>5]');
    expect(collapsedOf(doc).has('left')).toBe(false);
    fireEvent.pointerDown(document.body);
    await user.keyboard('[/Space]');
    expect(collapsedOf(doc).has('left')).toBe(false);
  });

  it('collapses a focused group with Space and opens merged popovers from a focused card', async () => {
    const { user, editor, doc } = setup(mergedDeck);
    act(() => {
      ui().focus('group:left');
      ui().select({ groups: ['left'] });
      document.querySelector<HTMLElement>('[data-node-id="group:left"]')?.focus();
    });
    await user.keyboard(' ');
    expect(collapsedOf(doc).has('left')).toBe(true);
    expect(ui().focusedId).toBe('collapsed:left');

    act(() => {
      toggleGroupCollapsed(editor(), 'right');
      ui().focus('collapsed:left');
      ui().select({ groups: ['left'] });
      document.querySelector<HTMLElement>('[data-node-id="collapsed:left"]')?.focus();
    });
    await user.keyboard('e');
    expect(ui().focusedEdgeId).toBe('merged:collapsed:left|collapsed:right');
    await user.keyboard('{Enter}');
    expect(ui().popover).toEqual({
      kind: 'merged',
      edgeId: 'merged:collapsed:left|collapsed:right',
    });
  });

  describe('outside proxies (034)', () => {
    it('reaches a proxy with the arrows without selecting it, and Enter goes to the real card', async () => {
      const { user } = setup(groupedDeck);
      act(() => {
        ui().drillInto({ kind: 'group', id: 'core', viewport: { x: 0, y: 0, zoom: 1 } });
      });
      focusNode('inside');
      await user.keyboard('{ArrowRight}');
      expect(ui().focusedId).toBe('port:outside');
      expect(ui().selection.nodes).toEqual(['inside']);
      await waitFor(() => {
        expect(document.querySelector('[data-node-id="port:outside"]')).toHaveFocus();
      });
      await user.keyboard('{Enter}');
      expect(ui().drill).toEqual([]);
      expect(ui().selection.nodes).toEqual(['outside']);
      expect(ui().focusedId).toBe('outside');
    });
  });

  describe('bundles (034)', () => {
    const bundleDeck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 0 } },
        { id: 'c', type: 'service', title: 'C', position: { x: 0, y: 300 } },
      ],
      edges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'b' },
        { id: 'e3', from: 'a', to: 'c' },
      ],
    });

    it("E cycles a card's connections, a bundle counted once, and Enter opens its popover", async () => {
      const { user } = setup(bundleDeck);
      focusNode('a');
      await user.keyboard('e');
      expect(ui().focusedEdgeId).toBe('e3');
      await user.keyboard('e');
      expect(ui().focusedEdgeId).toBe('bundle:a|b');
      expect(ui().announcement.text).toBe('2 connections between A and B');
      await user.keyboard('{Enter}');
      expect(ui().popover).toEqual({ kind: 'merged', edgeId: 'bundle:a|b' });
    });

    it('Esc folds fanned bundles', async () => {
      const { user } = setup(bundleDeck);
      focusNode('a');
      act(() => {
        ui().toggleBundleFan('bundle:a|b');
      });
      expect(ui().fannedBundles.size).toBe(1);
      await user.keyboard('{Escape}');
      expect(ui().fannedBundles.size).toBe(0);
    });
  });

  it('extends the selection with shift + arrows', async () => {
    const { user } = setup();
    focusNode('n00');
    await user.keyboard('{Shift>}{ArrowDown}{ArrowRight}{/Shift}');
    expect(ui().selection.nodes).toEqual(['n00', 'n10', 'n11']);
  });

  it('selects every component with ⌘A / Ctrl+A', async () => {
    const { user } = setup();
    focusNode('n00');
    await user.keyboard('{Meta>}a{/Meta}');
    expect(ui().selection.nodes).toHaveLength(9);
    act(() => {
      ui().clearSelection();
    });
    await user.keyboard('{Control>}a{/Control}');
    expect(ui().selection.nodes).toHaveLength(9);
  });

  it('opens "Connect … to…" with C', async () => {
    const { user } = setup();
    focusNode('n00');
    await user.keyboard('c');
    expect(ui().popover).toEqual({ kind: 'connect', fromId: 'n00' });
    expect(screen.getByRole('dialog', { name: 'Connect N00 to…' })).toBeInTheDocument();
  });

  it('opens "Connect … to…" with C on a group, and E cycles its connectors (050 US4)', async () => {
    const { user } = setup(
      deckOf({
        ...groupedDeck,
        edges: [...groupedDeck.edges, { id: 'toCore', from: 'outside', to: 'core' }],
      }),
    );
    focusNode('group:core');
    await user.keyboard('c');
    expect(ui().popover).toEqual({ kind: 'connect', fromId: 'core' });
    expect(screen.getByRole('dialog', { name: 'Connect Core to…' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    focusNode('group:core');
    await user.keyboard('e');
    expect(ui().focusedEdgeId).toBe('toCore');
    expect(ui().announcement.text).toBe('Outside to Core');
    focusNode('outside');
    await user.keyboard('e');
    await user.keyboard('e');
    expect(ui().focusedEdgeId).toBe('toCore');
  });

  it('toggles focus mode with F, with or without a selection (051 US1)', async () => {
    const { user } = setup();
    focusNode('n11');
    await user.keyboard('f');
    expect(ui().focusMode).toBe(true);
    expect(ui().announcement.text).toBe('Focus mode on');
    await user.keyboard('f');
    expect(ui().focusMode).toBe(false);
    expect(ui().announcement.text).toBe('Focus mode off');
    act(() => {
      ui().clearSelection();
    });
    await user.keyboard('f');
    expect(ui().focusMode).toBe(true);
    expect(ui().announcement.text).toBe('Focus mode on');
    expect(ui().selection.nodes).toEqual([]);
    await user.keyboard('f');
    expect(ui().focusMode).toBe(false);
  });

  it('Esc ends focus mode and keeps the selection; the next Esc clears it (048 US6)', async () => {
    const { user } = setup();
    focusNode('n11');
    await user.keyboard('f');
    expect(ui().focusMode).toBe(true);
    await user.keyboard('{Escape}');
    expect(ui().focusMode).toBe(false);
    expect(ui().announcement.text).toBe('Focus mode off');
    expect(ui().selection.nodes).toEqual(['n11']);
    await user.keyboard('{Escape}');
    expect(ui().selection.nodes).toEqual([]);
  });

  it('focus follows a new selection while focus mode is on (048 US6)', async () => {
    const { user } = setup();
    focusNode('n11');
    await user.keyboard('f');
    act(() => {
      ui().select({ nodes: ['n01'] });
    });
    expect(ui().focusMode).toBe(true);
    expect(focusTargetId(ui().selection, new Set())).toBe('n01');
  });

  it('cycles through the focused component’s connections with E; Enter opens the popover', async () => {
    const { user } = setup();
    focusNode('n11');
    await user.keyboard('e');
    expect(ui().focusedEdgeId).toBe('e1');
    expect(ui().selection.edges).toEqual(['e1']);
    expect(ui().announcement.text).toBe('N11 to N12: right');
    await user.keyboard('e');
    expect(ui().focusedEdgeId).toBe('e2');
    await user.keyboard('e');
    expect(ui().focusedEdgeId).toBe('e1');
    await user.keyboard('{Enter}');
    expect(ui().popover).toEqual({ kind: 'edge', edgeId: 'e1' });
  });

  it('opens the details drawer with Enter on a component, cursor in its title (018)', async () => {
    const { user } = setup();
    focusNode('n22');
    expect(screen.queryByRole('complementary', { name: 'Details' })).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('complementary', { name: 'Details' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Title' })).toHaveFocus();
    });
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('N22');
  });

  it('renames the focused component with F2, all text selected (019 FR-002)', async () => {
    const { user } = setup();
    focusNode('n11');
    await user.keyboard('{F2}');
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Component title' });
    expect(field).toHaveFocus();
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 3]);
    expect(ui().titleEdit).toEqual({ target: 'node', id: 'n11', isNew: false });
    expect(screen.queryByRole('complementary', { name: 'Details' })).not.toBeInTheDocument();
    await user.keyboard('Renamed{Enter}');
    expect(screen.getByRole('group', { name: 'Service: Renamed' })).toHaveFocus();
  });

  it('renames the selected group with F2 (019 FR-008)', async () => {
    const { user } = setup(groupedDeck);
    act(() => {
      ui().select({ groups: ['core'] });
      ui().focus('group:core');
      document.querySelector<HTMLElement>('[data-node-id="group:core"]')?.focus();
    });
    await user.keyboard('{F2}');
    expect(screen.getByRole('textbox', { name: 'Group title' })).toHaveFocus();
  });

  it('ignores F2 in flow mode (019 FR-010)', async () => {
    const { user } = setup(playbackDeck);
    focusNode('a');
    act(() => {
      ui().openFlow('checkout');
    });
    await user.keyboard('{F2}');
    expect(ui().titleEdit).toBeNull();
  });

  it('clears the selection with Escape, but closes a popover first', async () => {
    const { user } = setup();
    focusNode('n00');
    await user.keyboard('c');
    await user.keyboard('{Escape}');
    expect(ui().popover).toBeNull();
    expect(ui().selection.nodes).toEqual(['n00']);
    focusNode('n00');
    await user.keyboard('{Escape}');
    expect(ui().selection.nodes).toEqual([]);
  });

  it('zooms with ⌘+ / ⌘− / ⌘0 without errors', async () => {
    const { user } = setup();
    focusNode('n00');
    await user.keyboard('{Meta>}={/Meta}{Meta>}-{/Meta}{Meta>}0{/Meta}');
    expect(ui().focusedId).toBe('n00');
  });

  it('adds a note with N at the tracked pointer', async () => {
    const { user, doc } = setup(deckOf({}));
    const canvas = screen.getByLabelText('Diagram');

    act(() => {
      ui().setCanvasPointer({ x: 240, y: 130 });
      canvas.focus();
    });
    await user.keyboard('n');
    expect(readDeck(doc).stickies[0]).toMatchObject({ text: '', position: { x: 240, y: 130 } });
    expect(ui().stickyDraft).toBe(readDeck(doc).stickies[0]?.id);
    expect(ui().stickyEditing).toBe(readDeck(doc).stickies[0]?.id);
    expect(ui().announcement.text).toBe('Note added');
  });

  it('falls back to the view centre when N has no tracked pointer', async () => {
    const { user, doc } = setup(deckOf({}));
    const canvas = screen.getByLabelText('Diagram');
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => new DOMRect(100, 50, 300, 200),
    });
    act(() => {
      ui().setCanvasPointer(null);
      canvas.focus();
    });
    await user.keyboard('n');
    expect(readDeck(doc).stickies[0]).toMatchObject({ text: '', position: { x: 250, y: 150 } });
  });

  it('does not add a note while typing', async () => {
    const { user, doc } = setup(deckOf({}));
    await user.click(screen.getByRole('textbox', { name: 'Notes' }));
    await user.keyboard('n');
    expect(readDeck(doc).stickies).toEqual([]);
  });

  it('does not add a note during a flow session or in flow mode', async () => {
    const session = setup(playbackDeck);
    const sessionCanvas = screen.getByLabelText('Diagram');
    act(() => {
      ui().startRecording('Flow', null);
      sessionCanvas.focus();
    });
    await session.user.keyboard('n');
    expect(readDeck(session.doc).stickies).toEqual([]);

    act(() => {
      ui().endSession();
      openFlow(session.editor(), 'order');
      sessionCanvas.focus();
    });
    await session.user.keyboard('n');
    expect(readDeck(session.doc).stickies).toEqual([]);
  });

  it('collapses, expands, nudges and edits the selected note with the keyboard', async () => {
    const { user, doc } = setup(stickyDeck);
    focusSticky();
    const [sticky] = screen.getAllByTestId('sticky-node');
    if (sticky === undefined) throw new Error('Expected sticky node');

    fireEvent.keyDown(sticky, { key: 'c', code: 'KeyC', altKey: true });
    expect(readDeck(doc).stickies.find((sticky) => sticky.id === 'st1')?.collapsed).toBe(true);
    expect(ui().announcement.text).toBe('Note collapsed');
    fireEvent.keyDown(sticky, { key: 'c', code: 'KeyC', altKey: true });
    expect(readDeck(doc).stickies.find((sticky) => sticky.id === 'st1')?.collapsed).toBeUndefined();
    expect(ui().announcement.text).toBe('Note expanded');

    await user.keyboard('{ArrowRight}{Shift>}{ArrowDown}{/Shift}');
    expect(readDeck(doc).stickies.find((sticky) => sticky.id === 'st1')?.position).toEqual({
      x: 48,
      y: 92,
    });

    const [editedSticky] = screen.getAllByTestId('sticky-node');
    if (editedSticky === undefined) throw new Error('Expected sticky node after move');
    fireEvent.keyDown(editedSticky, { key: 'Enter' });
    expect(ui().stickyEditing).toBe('st1');
    act(() => {
      ui().setStickyEditing(null);
    });
    const [renamedSticky] = screen.getAllByTestId('sticky-node');
    if (renamedSticky === undefined) throw new Error('Expected sticky node for rename');
    fireEvent.keyDown(renamedSticky, { key: 'F2' });
    expect(ui().stickyEditing).toBe('st1');
  });
});

describe('editor shortcuts', () => {
  it('goes up with Escape or Backspace when nothing is selected in a drilled scope', async () => {
    const { user } = setup(groupedDeck);
    act(() => {
      ui().drillInto({ kind: 'group', id: 'core', viewport: { x: 10, y: 20, zoom: 0.8 } });
    });
    await user.keyboard('{Escape}');
    expect(ui().drill).toEqual([]);

    act(() => {
      ui().drillInto({ kind: 'group', id: 'core', viewport: { x: 10, y: 20, zoom: 0.8 } });
    });
    await user.keyboard('{Backspace}');
    expect(ui().drill).toEqual([]);
    expect(ui().pendingDelete).toBeNull();
  });

  it('keeps the level when Backspace deletes, Escape clears, or Escape only closes a popover', async () => {
    const { user } = setup(groupedDeck);
    act(() => {
      ui().drillInto({ kind: 'group', id: 'core', viewport: { x: 10, y: 20, zoom: 0.8 } });
    });

    focusNode('inside');
    await user.keyboard('{Backspace}');
    expect(ui().pendingDelete).toEqual({ targets: [{ scope: 'nodes', id: 'inside' }] });
    expect(ui().drill.map((frame) => frame.id)).toEqual(['core']);

    act(() => {
      ui().cancelDelete();
      ui().clearSelection();
      ui().select({ nodes: ['inside'] });
    });
    await user.keyboard('{Escape}');
    expect(ui().selection.nodes).toEqual([]);
    expect(ui().drill.map((frame) => frame.id)).toEqual(['core']);

    focusNode('inside');
    await user.keyboard('c');
    expect(ui().popover).toEqual({ kind: 'connect', fromId: 'inside' });
    await user.keyboard('{Escape}');
    expect(ui().popover).toBeNull();
    expect(ui().selection.nodes).toEqual(['inside']);
    expect(ui().drill.map((frame) => frame.id)).toEqual(['core']);
  });

  it('does nothing with Escape or Backspace at the top level when nothing is selected', async () => {
    const { user } = setup();
    await user.keyboard('{Escape}{Backspace}');
    expect(ui().drill).toEqual([]);
    expect(ui().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
    expect(ui().pendingDelete).toBeNull();
  });

  it('opens the delete confirmation for the selection with Delete or Backspace', async () => {
    const { user } = setup();
    focusNode('n00');
    await user.keyboard('{Delete}');
    expect(ui().pendingDelete).toEqual({ targets: [{ scope: 'nodes', id: 'n00' }] });
    act(() => {
      ui().cancelDelete();
    });
    await user.keyboard('{Backspace}');
    expect(ui().pendingDelete).toEqual({ targets: [{ scope: 'nodes', id: 'n00' }] });
  });

  it('deletes a selected note with Backspace or Delete', async () => {
    const { user } = setup(stickyDeck);
    focusSticky();
    await user.keyboard('{Backspace}');
    expect(ui().pendingDelete).toEqual({ targets: [{ scope: 'stickies', id: 'st1' }] });
    act(() => {
      ui().cancelDelete();
    });
    await user.keyboard('{Delete}');
    expect(ui().pendingDelete).toEqual({ targets: [{ scope: 'stickies', id: 'st1' }] });
  });

  it('does nothing on Delete with an empty selection', async () => {
    const { user } = setup();
    focusNode('n00');
    act(() => {
      ui().clearSelection();
    });
    await user.keyboard('{Delete}');
    expect(ui().pendingDelete).toBeNull();
  });

  it('never deletes while typing in a text field', async () => {
    const { user } = setup();
    focusNode('n00');
    act(() => {
      ui().openDrawer();
    });
    await user.click(screen.getByRole('textbox', { name: 'Title' }));
    await user.keyboard('{Backspace}{Delete}');
    expect(ui().pendingDelete).toBeNull();
    await user.click(screen.getByRole('textbox', { name: 'Notes' }));
    await user.keyboard('x{Backspace}');
    expect(ui().pendingDelete).toBeNull();
  });

  it('undoes and redoes with ⌘Z / ⇧⌘Z / Ctrl+Y, and announces it', async () => {
    const { user, doc, editor } = setup();
    act(() => {
      editor().update('nodes', 'n00', { title: 'Renamed' });
    });
    focusNode('n00');
    await user.keyboard('{Meta>}z{/Meta}');
    expect(toJSON(doc).nodes[0]?.title).toBe('N00');
    expect(ui().announcement.text).toBe('Undone');
    await user.keyboard('{Shift>}{Meta>}z{/Meta}{/Shift}');
    expect(toJSON(doc).nodes[0]?.title).toBe('Renamed');
    expect(ui().announcement.text).toBe('Redone');
    await user.keyboard('{Control>}z{/Control}{Control>}y{/Control}');
    expect(toJSON(doc).nodes[0]?.title).toBe('Renamed');
  });

  it('leaves ⌘Z to a focused text field', async () => {
    const { user, doc, editor } = setup();
    act(() => {
      editor().update('nodes', 'n00', { title: 'Renamed' });
    });
    await user.click(screen.getByRole('textbox', { name: 'Notes' }));
    await user.keyboard('{Meta>}z{/Meta}');
    expect(toJSON(doc).nodes[0]?.title).toBe('Renamed');
  });
});

describe('⌘D duplicate (016 FR-009)', () => {
  it('duplicates the selection 24 px away and blocks the bookmark dialog', () => {
    const { doc, editor } = setup();
    focusNode('n00');
    const before = toJSON(doc).nodes.length;
    expect(fireEvent.keyDown(document.body, { key: 'd', code: 'KeyD', metaKey: true })).toBe(false);
    const nodes = toJSON(doc).nodes;
    expect(nodes).toHaveLength(before + 1);
    const original = nodes.find((n) => n.id === 'n00');
    expect(nodes.at(-1)?.position).toEqual({
      x: (original?.position?.x ?? 0) + 24,
      y: (original?.position?.y ?? 0) + 24,
    });
    expect(ui().selection.nodes).toEqual([nodes.at(-1)?.id]);
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).nodes).toHaveLength(before);
  });

  it('does nothing in a text field or without a selection', async () => {
    const { doc, user } = setup();
    const before = toJSON(doc).nodes.length;
    fireEvent.keyDown(document.body, { key: 'd', code: 'KeyD', ctrlKey: true });
    act(() => {
      ui().select({ nodes: ['n00'] });
    });
    await user.click(screen.getByRole('textbox', { name: 'Notes' }));
    await user.keyboard('{Meta>}d{/Meta}');
    expect(toJSON(doc).nodes).toHaveLength(before);
  });
});

describe('⇧⌘L lock (053)', () => {
  it('locks and unlocks the selected note', () => {
    const { doc } = setup(stickyDeck);
    focusSticky();
    fireEvent.keyDown(document.body, { key: 'L', code: 'KeyL', metaKey: true, shiftKey: true });
    expect(readDeck(doc).stickies.find((s) => s.id === 'st1')?.locked).toBe(true);
    fireEvent.keyDown(document.body, { key: 'L', code: 'KeyL', metaKey: true, shiftKey: true });
    expect(readDeck(doc).stickies.find((s) => s.id === 'st1')?.locked).toBeUndefined();
  });
});

describe('⌘G group (016 FR-010)', () => {
  it('groups the selection, blocks the browser find and opens the new name', () => {
    const { doc } = setup();
    act(() => {
      ui().select({ nodes: ['n00', 'n01'] });
    });
    expect(fireEvent.keyDown(document.body, { key: 'g', code: 'KeyG', metaKey: true })).toBe(false);
    const group = toJSON(doc).groups.at(-1);
    expect(group?.title).toBe('New group');
    expect(ui().titleEdit).toMatchObject({ target: 'group', id: group?.id, isNew: true });
  });

  it('does nothing with one component, and plain G no longer announces anything', () => {
    const { doc } = setup();
    focusNode('n00');
    fireEvent.keyDown(document.body, { key: 'g', code: 'KeyG', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'g', code: 'KeyG' });
    expect(toJSON(doc).groups).toEqual([]);
    expect(ui().announcement.text).not.toMatch(/coming soon/);
  });
});

describe('⌥ keys on the canvas (016 US3, US5)', () => {
  it('aligns with ⌥A / ⌥D / ⌥W / ⌥S, matched by code', () => {
    const { doc } = setup();
    focusNode('n00');
    act(() => {
      ui().select({ nodes: ['n00', 'n11'] });
    });
    const el = document.querySelector<HTMLElement>('[data-node-id="n00"]');
    if (el === null) throw new Error('no card');
    // ⌥A types "å" on a Mac: the code decides.
    fireEvent.keyDown(el, { key: 'å', code: 'KeyA', altKey: true });
    const [n00, n11] = ['n00', 'n11'].map((id) => toJSON(doc).nodes.find((n) => n.id === id));
    expect(n11?.position?.x).toBe(n00?.position?.x);
    expect(ui().announcement.text).toBe('Aligned 2 components left');
  });

  it('nudges with ⌥ arrows and still moves focus with plain arrows', () => {
    const { doc } = setup();
    focusNode('n11');
    const el = document.querySelector<HTMLElement>('[data-node-id="n11"]');
    if (el === null) throw new Error('no card');
    const before = toJSON(doc).nodes.find((n) => n.id === 'n11')?.position;
    fireEvent.keyDown(el, { key: 'ArrowRight', code: 'ArrowRight', altKey: true });
    expect(toJSON(doc).nodes.find((n) => n.id === 'n11')?.position).toEqual({
      x: (before?.x ?? 0) + 1,
      y: before?.y ?? 0,
    });
  });

  it('ignores ⌥ keys in a text field', async () => {
    const { doc, user } = setup();
    act(() => {
      ui().select({ nodes: ['n00', 'n11'] });
    });
    const before = toJSON(doc);
    await user.click(screen.getByRole('textbox', { name: 'Notes' }));
    await user.keyboard('{Alt>}a{ArrowRight}{/Alt}');
    expect(toJSON(doc)).toEqual(before);
  });
});

describe('problem walk (015 FR-021)', () => {
  function Walker({ onProblem, canvas }: { onProblem: (d: 1 | -1) => void; canvas: boolean }) {
    useEditorShortcuts({ canvas, onProblem });
    return <input aria-label="Notes" />;
  }

  it.each([true, false])('⌘. goes forward and ⇧⌘. back (canvas screen: %s)', async (canvas) => {
    const onProblem = vi.fn();
    const env = editorWrapper(grid);
    render(<Walker onProblem={onProblem} canvas={canvas} />, { wrapper: env.wrapper });
    const user = userEvent.setup();
    await user.keyboard('{Meta>}[Period]{/Meta}');
    expect(onProblem).toHaveBeenLastCalledWith(1);
    await user.keyboard('{Control>}{Shift>}[Period]{/Shift}{/Control}');
    expect(onProblem).toHaveBeenLastCalledWith(-1);
    expect(onProblem).toHaveBeenCalledTimes(2);
  });

  it('ignores ⌘. while typing', async () => {
    const onProblem = vi.fn();
    const env = editorWrapper(grid);
    render(<Walker onProblem={onProblem} canvas />, { wrapper: env.wrapper });
    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox', { name: 'Notes' }));
    await user.keyboard('{Meta>}[Period]{/Meta}');
    expect(onProblem).not.toHaveBeenCalled();
  });
});

describe('R resets a bend drag (022)', () => {
  it('does nothing outside a bend gesture', () => {
    const env = editorWrapper(grid);
    render(<Editor />, { wrapper: env.wrapper });
    expect(fireEvent.keyDown(document.body, { key: 'r' })).toBe(true);
    expect(ui().announcement.text).not.toBe('Route reset');
  });

  it('resets the route to automatic mid-drag, without leaving the drag in history', () => {
    const env = editorWrapper(grid);
    render(<Editor />, { wrapper: env.wrapper });
    const editor = env.editor();
    editor.setEdgeRoute('e1', { offset: 40 });
    const corner = { x: 0, y: 0 };
    startBendDrag(
      editor,
      {
        edgeId: 'e1',
        fromCentre: corner,
        toCentre: { x: 100, y: 100 },
        start: corner,
        end: { x: 100, y: 100 },
        bends: [{ x: 50, y: 0 }],
      },
      { kind: 'move', index: 0 },
    );
    expect(fireEvent.keyDown(document.body, { key: 'r' })).toBe(false);
    expect(ui().announcement.text).toBe('Route reset');
    expect(readDeck(editor.doc).edges.find((e) => e.id === 'e1')?.route).toBeUndefined();
    editor.undo();
    expect(readDeck(editor.doc).edges.find((e) => e.id === 'e1')?.route?.offset).toBe(40);
  });
});

describe('isTextTarget', () => {
  it('recognises inputs, textareas, selects and contenteditable', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    for (const el of [
      document.createElement('input'),
      document.createElement('textarea'),
      document.createElement('select'),
    ]) {
      expect(isTextTarget(el)).toBe(true);
    }
    expect(isTextTarget(editable)).toBe(true);
    expect(isTextTarget(document.createElement('button'))).toBe(false);
    expect(isTextTarget(null)).toBe(false);
  });

  it('saves now on ⌘S / Ctrl+S, even in a text field, and blocks the browser dialog', () => {
    const flush = vi.fn(() => Promise.resolve());
    const env = editorWrapper(grid);
    render(
      <SaveContext value={{ mode: 'stored', flush, markExported: () => undefined }}>
        <Editor />
      </SaveContext>,
      { wrapper: env.wrapper },
    );
    expect(fireEvent.keyDown(document.body, { key: 's', metaKey: true })).toBe(false);
    expect(
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Notes' }), {
        key: 's',
        ctrlKey: true,
      }),
    ).toBe(false);
    expect(flush).toHaveBeenCalledTimes(2);
    // Plain "s" is typing, not a save.
    expect(fireEvent.keyDown(document.body, { key: 's' })).toBe(true);
    expect(flush).toHaveBeenCalledTimes(2);
  });
});

describe('keyboard recording (006 FR-015, FR-017)', () => {
  function record(flowFile = grid) {
    const env = setup(flowFile);
    act(() => {
      ui().startRecording('Flow', null);
    });
    const canvas = document.querySelector<HTMLElement>('[data-canvas]');
    act(() => {
      canvas?.focus();
    });
    return env;
  }

  it('Tab / Shift+Tab cycle candidates with the focus ring and name; Enter records', async () => {
    const { user, doc } = record();
    await user.keyboard('{Tab}');
    // Step 1: every edge in reading order (source n01 is above n11).
    expect(ui().flowSession?.candidateEdgeId).toBe('e2');
    expect(ui().focusedEdgeId).toBe('e2');
    expect(ui().announcement.text).toBe('N01 to N11');
    await user.keyboard('{Tab}');
    expect(ui().flowSession?.candidateEdgeId).toBe('e1');
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(ui().flowSession?.candidateEdgeId).toBe('e2');
    await user.keyboard('{Enter}');
    expect(toJSON(doc).flows[0]?.steps.map((s) => s.edge)).toEqual(['e2']);
    // Next: the edges leaving n11 only.
    await user.keyboard('{Tab}');
    expect(ui().flowSession?.candidateEdgeId).toBe('e1');
  });

  it('lets Tab leave the canvas when there are no candidates', () => {
    record(deckOf({ nodes: grid.nodes }));
    const canvas = document.querySelector<HTMLElement>('[data-canvas]');
    // Not prevented: the browser moves focus on, so Done stays reachable.
    expect(fireEvent.keyDown(canvas ?? document.body, { key: 'Tab' })).toBe(true);
    expect(ui().flowSession?.candidateEdgeId).toBeNull();
  });

  it('pauses C and Delete, and Esc cancels an empty recording', async () => {
    const { user } = record();
    focusNode('n00');
    await user.keyboard('c');
    expect(ui().popover).toBeNull();
    await user.keyboard('{Delete}');
    expect(ui().pendingDelete).toBeNull();
    await user.keyboard('{Escape}');
    expect(ui().flowSession).toBeNull();
  });
});

describe('keyboard in flow mode (007)', () => {
  it('allows Space collapse, but ignores arrows, C, E, Enter, F and Backspace; Esc exits flow mode', async () => {
    const { user, editor, doc } = setup(groupedPlaybackDeck);
    act(() => {
      ui().select({ groups: ['core'] });
      ui().focus('group:core');
      ui().drillInto({ kind: 'group', id: 'core', viewport: { x: 10, y: 20, zoom: 0.8 } });
      ui().drillUp();
    });
    document.querySelector<HTMLElement>('[data-node-id="group:core"]')?.focus();
    act(() => {
      openFlow(editor(), 'order');
    });
    const stepId = ui().activeFlow?.stepId;
    await user.keyboard(' ');
    expect(collapsedOf(doc).has('core')).toBe(true);
    // Collapsing writes only the view's collapsed list (011); nothing else changes below.
    const before = toJSON(doc);
    expect(ui().activeFlow?.stepId).toBe(stepId);
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}cE{Enter}f{Backspace}');
    expect(ui().focusedId).toBe('collapsed:core');
    expect(ui().popover).toBeNull();
    expect(ui().pendingDelete).toBeNull();
    expect(ui().focusMode).toBe(false);
    expect(toJSON(doc)).toEqual(before);
    expect(ui().activeFlow?.flowId).toBe('order');
    expect(ui().drill).toEqual([]);
    await user.keyboard('{Escape}');
    expect(ui().activeFlow).toBeNull();
  });
});

describe('⌘⇧ arrow resize (017 US5, T048)', () => {
  it('grows 4 px with → and ↓, keeping the top-left corner, one undo step and a final announcement', () => {
    vi.useFakeTimers();
    const { doc } = setup();
    focusNode('n11');
    const el = document.querySelector<HTMLElement>('[data-node-id="n11"]');
    if (el === null) throw new Error('no card');
    const before = toJSON(doc).nodes.find((n) => n.id === 'n11')?.position;
    fireEvent.keyDown(el, { key: 'ArrowRight', code: 'ArrowRight', metaKey: true, shiftKey: true });
    fireEvent.keyDown(el, { key: 'ArrowDown', code: 'ArrowDown', metaKey: true, shiftKey: true });
    vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
    const node = toJSON(doc).nodes.find((n) => n.id === 'n11');
    expect(node?.size).toEqual({ width: 188, height: 80 });
    expect(node?.position).toEqual(before);
    expect(ui().announcement.text).toBe('Resized N11 to 188 × 80');
    vi.useRealTimers();
  });

  it('shrinks with ← and ↑, clamped to the minimum size', () => {
    const { doc } = setup();
    focusNode('n11');
    const el = document.querySelector<HTMLElement>('[data-node-id="n11"]');
    if (el === null) throw new Error('no card');
    for (let i = 0; i < 40; i++) {
      fireEvent.keyDown(el, { key: 'ArrowLeft', code: 'ArrowLeft', metaKey: true, shiftKey: true });
    }
    expect(toJSON(doc).nodes.find((n) => n.id === 'n11')?.size?.width).toBe(120);
  });

  it('does nothing without a focused component, and ⌘⇧A still selects all', () => {
    const { doc } = setup();
    const canvas = canvasElement();
    if (canvas === null) throw new Error('no canvas');
    const before = toJSON(doc);
    expect(
      fireEvent.keyDown(canvas, {
        key: 'ArrowRight',
        code: 'ArrowRight',
        metaKey: true,
        shiftKey: true,
      }),
    ).toBe(true);
    expect(toJSON(doc)).toEqual(before);
    fireEvent.keyDown(canvas, { key: 'a', code: 'KeyA', metaKey: true, shiftKey: true });
    expect(ui().selection.nodes.length).toBe(9);
  });
});

describe('⌥ arrows (016 nudge)', () => {
  it('still nudges a component selection with ⌥ arrows (016 regression)', () => {
    const { doc } = setup();
    focusNode('n11');
    const el = document.querySelector<HTMLElement>('[data-node-id="n11"]');
    if (el === null) throw new Error('no card');
    const before = toJSON(doc).nodes.find((n) => n.id === 'n11')?.position;
    fireEvent.keyDown(el, { key: 'ArrowRight', code: 'ArrowRight', altKey: true });
    expect(toJSON(doc).nodes.find((n) => n.id === 'n11')?.position).toEqual({
      x: (before?.x ?? 0) + 1,
      y: before?.y ?? 0,
    });
  });

  it('ignores ⌘⇧ arrows and ⌥ arrows in a text field', async () => {
    const { doc, user } = setup();
    act(() => {
      ui().select({ edges: ['e1'], nodes: [] });
    });
    const before = toJSON(doc);
    await user.click(screen.getByRole('textbox', { name: 'Notes' }));
    await user.keyboard('{Meta>}{Shift>}{ArrowRight}{/Shift}{/Meta}');
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(toJSON(doc)).toEqual(before);
  });

  it('ignores ⌥ arrows and ⌘⇧ arrows in flow mode (view-only, 007 FR-009)', () => {
    const { doc, editor } = setup(playbackDeck);
    act(() => {
      ui().select({ edges: ['ab'] });
      openFlow(editor(), 'order');
    });
    const canvas = canvasElement();
    if (canvas === null) throw new Error('no canvas');
    const before = toJSON(doc);
    fireEvent.keyDown(canvas, { key: 'ArrowRight', code: 'ArrowRight', altKey: true });
    fireEvent.keyDown(canvas, {
      key: 'ArrowRight',
      code: 'ArrowRight',
      metaKey: true,
      shiftKey: true,
    });
    expect(toJSON(doc)).toEqual(before);
  });
});

describe('⌘F column filter (048)', () => {
  const tables = deckOf({
    nodes: [
      {
        id: 't1',
        type: 'db-table',
        title: 'orders',
        position: { x: 0, y: 0 },
        columns: [{ id: 'c1', name: 'id', type: 'int', pk: true }],
      },
      { id: 't2', type: 'db-table', title: 'items', position: { x: 400, y: 0 }, columns: [] },
      { id: 's', type: 'service', title: 'Svc', position: { x: 800, y: 0 } },
    ],
  });
  const mod = (target: Element | null) =>
    fireEvent.keyDown(target ?? document.body, { key: 'f', metaKey: true });

  it('opens the filter on the one selected table and blocks the browser find', () => {
    setup(tables);
    focusNode('t1');
    expect(mod(document.activeElement)).toBe(false);
    expect(ui().tableFilter).toEqual({ tableId: 't1', text: '', index: 0 });
    // Ctrl+F too.
    act(() => {
      ui().closeTableFilter();
    });
    focusNode('t1');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'f', ctrlKey: true });
    expect(ui().tableFilter?.tableId).toBe('t1');
  });

  it('does nothing with no table, a non-table card or several tables selected', () => {
    setup(tables);
    expect(mod(document.body)).toBe(true);
    expect(ui().tableFilter).toBeNull();
    focusNode('s');
    mod(document.activeElement);
    expect(ui().tableFilter).toBeNull();
    act(() => {
      ui().select({ nodes: ['t1', 't2'] });
    });
    mod(document.activeElement);
    expect(ui().tableFilter).toBeNull();
  });

  it('leaves a text field alone', () => {
    setup(tables);
    focusNode('t1');
    const input = screen.getByLabelText('Notes');
    expect(mod(input)).toBe(true);
    expect(ui().tableFilter).toBeNull();
  });
});
