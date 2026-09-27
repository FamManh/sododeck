import { fromJSON, toJSON, type DeckDoc, type DeckEditor } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { TooltipProvider } from '@sododeck/ui/components/tooltip';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as EditorContextModule from '../model/editor-context';
import { useUiStore } from '../state/ui-store';
import { EditorProbe } from '../test/editor-probe';
import { EditorPage } from './editor-page';

// Monaco does not run in jsdom; the JSON panel has its own coverage.
vi.mock('../editor/json-panel', () => ({ JsonPanel: () => null }));

const opened = vi.hoisted(() => ({
  doc: undefined as DeckDoc | undefined,
  editor: undefined as DeckEditor | undefined,
}));

// The page's own editor (the one that owns the undo history), for the drag gesture.
vi.mock('../model/editor-context', async (importOriginal) => {
  const actual = await importOriginal<typeof EditorContextModule>();
  return {
    EditorProvider: ({ doc, children }: Parameters<typeof actual.EditorProvider>[0]) => (
      <actual.EditorProvider doc={doc}>
        <EditorProbe
          onEditor={(editor) => {
            opened.editor = editor;
          }}
        />
        {children}
      </actual.EditorProvider>
    ),
  };
});
vi.mock('../editor/open-deck', () => ({
  openDeck: () => {
    if (!opened.doc) throw new Error('no test doc');
    return opened.doc;
  },
}));

function openEditor(file: SododeckFile = { ...emptySododeckFile(), name: 'Untitled deck' }) {
  opened.doc = fromJSON(file);
  const doc = opened.doc;
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={['/deck/new']}>
        <Routes>
          <Route path="/deck/:deckId" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  );
  return { doc, user: userEvent.setup() };
}

const ui = () => useUiStore.getState();
const announced = () => ui().announcement.text;
const nodeEl = (name: string) => screen.getByRole('group', { name });

beforeEach(() => {
  useUiStore.getState().setLabelsOn(false);
});

describe('EditorPage', () => {
  it('opens an empty deck with the empty-canvas card and the shell', () => {
    openEditor();
    expect(screen.getByRole('complementary', { name: 'Outline' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Start your diagram' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      'Untitled deck',
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('undoes and redoes every canvas edit one user action at a time (SC-004)', async () => {
    const { doc, user } = openEditor();
    const states = [toJSON(doc)];
    const record = () => states.push(toJSON(doc));

    // add ×2 from the palette
    await user.click(screen.getByRole('tab', { name: 'Palette' }));
    await user.click(screen.getByRole('button', { name: 'Add Service' }));
    expect(announced()).toBe('Added New service');
    record();
    await user.click(screen.getByRole('button', { name: 'Add Database' }));
    record();

    // connect with the keyboard, then label it in the popover
    act(() => {
      nodeEl('Database: New database').focus();
    });
    await user.keyboard('c');
    await user.keyboard('serv{Enter}');
    expect(announced()).toBe('Connected New database to New service');
    record();
    const popover = await screen.findByRole('dialog', { name: 'Connection' });
    const label = within(popover).getByRole('textbox', { name: 'Label' });
    await waitFor(() => {
      expect(label).toHaveFocus();
    });
    await user.keyboard('reads{Enter}');
    record();

    // rename in the inspector
    await user.click(screen.getByRole('tab', { name: 'Outline' }));
    await user.click(screen.getByRole('treeitem', { name: 'New service' }));
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Orders{Enter}');
    record();

    // move (the gesture the drag handlers run)
    const id = toJSON(doc).nodes[0]?.id ?? '';
    act(() => {
      const editor = opened.editor;
      if (!editor) throw new Error('no editor');
      editor.beginGesture();
      for (let x = 1; x <= 20; x++) {
        editor.batch(() => {
          editor.update('nodes', id, { position: { x: x * 10, y: x * 5 } });
        });
      }
      editor.endGesture();
    });
    record();

    // delete + confirm
    act(() => {
      ui().select({ nodes: [id] });
      ui().requestDelete({ nodes: [id], edges: [] });
    });
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Orders?' });
    expect(dialog).toHaveTextContent('Also removes 1 connection.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(announced()).toMatch(/^Deleted Orders and 1 connection/);
    record();

    const header = screen.getByRole('banner');
    const undo = within(header).getByRole('button', { name: 'Undo' });
    const redo = within(header).getByRole('button', { name: 'Redo' });
    for (let i = states.length - 2; i >= 0; i--) {
      await user.click(undo);
      expect(toJSON(doc)).toEqual(states[i]);
    }
    expect(undo).toBeDisabled();
    for (let i = 1; i < states.length; i++) {
      await user.click(redo);
      expect(toJSON(doc)).toEqual(states[i]);
    }
    expect(redo).toBeDisabled();
  });

  it('completes add, connect, label, delete and undo with the keyboard only (SC-002)', async () => {
    const { doc, user } = openEditor();
    const titles = () => toJSON(doc).nodes.map((n) => n.title);

    // 1. To the palette, add Service and Database.
    act(() => {
      screen.getByRole('button', { name: 'Open palette' }).focus();
    });
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Service' })).toHaveFocus();
    });
    await user.keyboard('{Enter}');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Add Database' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(titles()).toEqual(['New service', 'New database']);

    // 2. Into the canvas (the newest component holds the Tab stop), then the arrows.
    // Past the four other palette cards.
    for (let i = 0; i < 5; i++) await user.tab();
    expect(nodeEl('Database: New database')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(nodeEl('Service: New service')).toHaveFocus();
    });

    // 3. Connect with C, type-ahead, Enter; label it; Enter.
    await user.keyboard('c');
    await user.keyboard('dat{Enter}');
    const popover = await screen.findByRole('dialog', { name: 'Connection' });
    await waitFor(() => {
      expect(within(popover).getByRole('textbox', { name: 'Label' })).toHaveFocus();
    });
    await user.keyboard('reads{Enter}');
    expect(toJSON(doc).edges).toMatchObject([{ label: 'reads' }]);
    await waitFor(() => {
      expect(nodeEl('Service: New service')).toHaveFocus();
    });

    // 4. Delete the selected connection, confirm on "Delete".
    await user.keyboard('{Delete}');
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(toJSON(doc).edges).toEqual([]);

    // 5. ⌘Z brings it back.
    await user.keyboard('{Meta>}z{/Meta}');
    expect(toJSON(doc).edges).toMatchObject([{ label: 'reads' }]);
    expect(announced()).toBe('Undone');
  });
});
