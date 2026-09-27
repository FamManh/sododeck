import { toJSON } from '@sododeck/model';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { readDeck } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';
import { playbackDeck } from '../test/flow-fixtures';
import { deckOf, editorWrapper } from '../test/render-canvas';
import { Canvas } from './canvas';
import { openFlow } from './flows/flow-mode';
import { Inspector } from './inspector';
import { SaveContext } from './save-context';
import { isTextTarget, useEditorShortcuts } from './use-canvas-shortcuts';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';

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

const ui = () => useUiStore.getState();

function Editor() {
  useEditorShortcuts();
  const deck = useDeckSnapshot(useEditor().doc);
  return (
    <>
      <input aria-label="Notes" />
      <Canvas />
      <Inspector deck={deck} />
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
    const { user } = setup(groupedDeck);
    focusNode('inside');
    await user.keyboard('{ArrowLeft}');
    expect(ui().focusedId).toBe('group:core');
    expect(ui().selection.groups).toEqual(['core']);
    await waitFor(() => {
      expect(document.querySelector('[data-node-id="group:core"]')).toHaveFocus();
    });

    act(() => {
      ui().toggleCollapsed('core');
      ui().focus('outside');
      ui().select({ nodes: ['outside'] });
    });
    await user.keyboard('{ArrowLeft}');
    expect(ui().focusedId).toBe('collapsed:core');
    expect(ui().selection.groups).toEqual(['core']);
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

  it('puts the cursor in the inspector title with Enter on a component', async () => {
    const { user } = setup();
    focusNode('n22');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Title' })).toHaveFocus();
    });
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('N22');
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
  it('ignores arrows, C, E, Enter and Delete on the canvas; Esc exits flow mode', async () => {
    const { user, editor, doc } = setup(playbackDeck);
    focusNode('b');
    act(() => {
      openFlow(editor(), 'order');
    });
    const before = toJSON(doc);
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}cE{Enter}{Delete}');
    expect(ui().focusedId).toBe('b');
    expect(ui().popover).toBeNull();
    expect(ui().pendingDelete).toBeNull();
    expect(document.activeElement).toHaveAttribute('data-node-id', 'b');
    expect(toJSON(doc)).toEqual(before);
    expect(ui().activeFlow?.flowId).toBe('order');
    await user.keyboard('{Escape}');
    expect(ui().activeFlow).toBeNull();
  });
});
