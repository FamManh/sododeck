import { toJSON } from '@sododeck/model';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, editorWrapper } from '../test/render-canvas';
import { Canvas } from './canvas';
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
});

describe('editor shortcuts', () => {
  it('opens the delete confirmation for the selection with Delete or Backspace', async () => {
    const { user } = setup();
    focusNode('n00');
    await user.keyboard('{Delete}');
    expect(ui().pendingDelete).toEqual({ nodes: ['n00'], edges: [] });
    act(() => {
      ui().cancelDelete();
    });
    await user.keyboard('{Backspace}');
    expect(ui().pendingDelete).toEqual({ nodes: ['n00'], edges: [] });
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
