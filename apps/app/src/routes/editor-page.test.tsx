import { assetId, fromJSON, serializeDeck, toJSON, type DeckEditor } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { TooltipProvider } from '@sododeck/ui/components/tooltip';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { PNG_1X1 } from '../images/test-pictures';
import type * as EditorContextModule from '../model/editor-context';
import { useUiStore } from '../state/ui-store';
import { listBlobIds, putBlob } from '../storage/blob-store';
import * as download from '../storage/download';
import {
  createFolder,
  insertDeck,
  loadDeckLog,
  softDeleteDeck,
  type LibraryDb,
} from '../storage/library-db';
import { renameDeck } from '../library/library-actions';
import { inProcessLibraryClient } from '../test/in-process-library-client';
import { setLibraryDbForTests } from '../storage/library-db-instance';
import { EditorProbe } from '../test/editor-probe';
import { legacyDeckBytes, pinnedNoteDeckBytes } from '../test/legacy-deck';
import { deckRecord, freshLibraryDb } from '../test/library-fixtures';
import { RulesPage } from '../editor/rules/rules-page';
import { deckLoader } from './deck-loader';
import { EditorPage } from './editor-page';

// Monaco does not run in jsdom; the JSON panel has its own coverage.
vi.mock('../editor/json-panel', () => ({ JsonPanel: () => null }));

const opened = vi.hoisted(() => ({ editor: undefined as DeckEditor | undefined }));

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

let db: LibraryDb;

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Library home</p> },
      {
        path: '/deck/:deckId',
        loader: deckLoader,
        Component: EditorPage,
        children: [{ path: 'rules/:ruleId?', Component: RulesPage }],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
  return router;
}

/** Stores `file` as deck `d1` and opens it in the editor. */
async function openEditor(file: SododeckFile = { ...emptySododeckFile(), name: 'Untitled deck' }) {
  await insertDeck(
    db,
    deckRecord('d1', { name: file.name ?? 'Untitled deck', updatedAt: 5 }),
    Y.encodeStateAsUpdate(fromJSON(file)),
  );
  const router = renderAt('/deck/d1');
  await screen.findByRole('toolbar', { name: 'Deck' });
  const doc = opened.editor?.doc;
  if (!doc) throw new Error('editor not mounted');
  return { doc, router, user: userEvent.setup() };
}

beforeEach(async () => {
  db = await freshLibraryDb();
  setLibraryDbForTests(db);
  opened.editor = undefined;
});

afterEach(() => {
  setLibraryDbForTests(undefined);
  vi.restoreAllMocks();
});

const ui = () => useUiStore.getState();
const announced = () => ui().announcement.text;
/** A component by name, whether or not it currently has problems (", 1 problem", 015). */
const nodeEl = (name: string) =>
  screen.getByRole('group', {
    name: (actual) => actual === name || new RegExp(`^${name}, \\d+ problems?$`).test(actual),
  });

beforeEach(() => {
  useUiStore.getState().setLabelsOn(false);
});

const record = async () => db.decks.get('d1');

/** The rule editor from the canvas (018): the rail's Rules flyout, then "Open rule editor". */
async function openRulesFromRail(user: ReturnType<typeof userEvent.setup>) {
  // The rail's button: a selected component's toolbar has a "Rules" button too (019).
  const rail = document.querySelector<HTMLElement>('[data-region="rail"]');
  if (rail === null) throw new Error('no rail');
  await user.click(within(rail).getByRole('button', { name: 'Rules' }));
  await user.click(screen.getByRole('button', { name: 'Open rule editor' }));
}

describe('EditorPage', () => {
  it('opens an empty deck with the empty-canvas card and the canvas-first shell (018)', async () => {
    await openEditor();
    for (const name of ['Deck', 'Tools', 'Canvas tools', 'History', 'Zoom']) {
      expect(screen.getByRole('toolbar', { name })).toBeInTheDocument();
    }
    // No fixed columns: panels open on request.
    expect(screen.queryByRole('complementary', { name: 'Inspector' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'JSON' })).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Start your diagram' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename deck' })).toHaveTextContent('Untitled deck');
    expect(screen.getByText('Saved in this browser')).toBeInTheDocument();
  });

  it('keeps the pictures a deck uses and sweeps the others when it opens (055 FR-011)', async () => {
    const used = assetId(PNG_1X1);
    const orphan = 'e'.repeat(64);
    const file: SododeckFile = {
      ...emptySododeckFile(),
      name: 'Pictures',
      images: [
        { id: 'i1', asset: used, position: { x: 0, y: 0 }, size: { width: 80, height: 40 } },
      ],
      assets: {
        [used]: {
          type: 'image/png',
          bytes: PNG_1X1.length,
          width: 1,
          height: 1,
          name: 'a.png',
          data: '',
        },
      },
    };
    await putBlob(db, 'd1', used, { type: 'image/png', bytes: PNG_1X1 });
    await putBlob(db, 'd1', orphan, { type: 'image/png', bytes: new Uint8Array([1, 2]) });
    await putBlob(db, 'other', orphan, { type: 'image/png', bytes: new Uint8Array([1, 2]) });
    await openEditor(file);
    await waitFor(async () => {
      expect(await listBlobIds(db, 'd1')).toEqual([used]);
    });
    // Another deck's pictures are not touched.
    expect(await listBlobIds(db, 'other')).toEqual([orphan]);
  });

  it('undoes and redoes every canvas edit one user action at a time (SC-004)', async () => {
    const { doc, user } = await openEditor();
    const states = [toJSON(doc)];
    const record = () => states.push(toJSON(doc));

    // add ×2 from the palette flyout
    await user.click(
      within(screen.getByRole('toolbar', { name: 'Canvas tools' })).getByRole('button', {
        name: 'Add component',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Service' }));
    expect(announced()).toBe('Added Untitled service');
    record();
    await user.click(screen.getByRole('button', { name: 'Database' }));
    record();

    // connect with the keyboard, then label it in the popover
    act(() => {
      nodeEl('Database: Untitled database').focus();
    });
    await user.keyboard('c');
    await user.keyboard('serv{Enter}');
    expect(announced()).toBe('Connected Untitled database to Untitled service');
    record();
    const popover = await screen.findByRole('dialog', { name: 'Connection' });
    const label = within(popover).getByRole('textbox', { name: 'Label' });
    await waitFor(() => {
      expect(label).toHaveFocus();
    });
    await user.keyboard('reads{Enter}');
    record();

    // rename in the details drawer, after picking it in the outline
    await user.click(screen.getByRole('button', { name: 'Outline' }));
    await user.click(screen.getByRole('treeitem', { name: 'Untitled service' }));
    await user.keyboard('{Meta>}{Shift>}d{/Shift}{/Meta}');
    const title = await screen.findByRole('textbox', { name: 'Title' });
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

    // delete (no confirmation on the canvas, §g-56)
    act(() => {
      ui().select({ nodes: [id] });
      ui().requestDelete({ nodes: [id], edges: [] });
    });
    expect(announced()).toMatch(/^Deleted Orders and 1 connection/);
    record();

    const history = screen.getByRole('toolbar', { name: 'History' });
    const undo = within(history).getByRole('button', { name: 'Undo' });
    const redo = within(history).getByRole('button', { name: 'Redo' });
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
    const { doc, user } = await openEditor();
    const titles = () => toJSON(doc).nodes.map((n) => n.title);

    // 1. To the palette flyout, add Service and Database.
    act(() => {
      within(screen.getByRole('region', { name: 'Start your diagram' }))
        .getByRole('button', { name: 'Add component' })
        .focus();
    });
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Search types' })).toHaveFocus();
    });
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Service' })).toHaveFocus();
    await user.keyboard('{Enter}');
    // The new card starts in title edit (019 US2); Esc keeps "Untitled service".
    const name = screen.getByRole('textbox', { name: 'Component title' });
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute('placeholder', 'Name this component');
    await user.keyboard('{Escape}');
    // The palette flyout is still open (018 rules).
    act(() => {
      screen.getByRole('button', { name: 'Database' }).focus();
    });
    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');
    expect(titles()).toEqual(['Untitled service', 'Untitled database']);

    // 2. Esc left focus on the newest card on the canvas; then the arrows.
    await waitFor(() => {
      expect(nodeEl('Database: Untitled database')).toHaveFocus();
    });
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(nodeEl('Service: Untitled service')).toHaveFocus();
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
      expect(nodeEl('Service: Untitled service')).toHaveFocus();
    });

    // 4. Delete the selected connection (no confirmation on the canvas, §g-56).
    await user.keyboard('{Delete}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(toJSON(doc).edges).toEqual([]);

    // 5. ⌘Z brings it back.
    await user.keyboard('{Meta>}z{/Meta}');
    expect(toJSON(doc).edges).toMatchObject([{ label: 'reads' }]);
    expect(announced()).toBe('Undone');
  });

  it('creates "Untitled deck" on /deck/new in the given folder and replaces the URL', async () => {
    const folder = await createFolder(db, 'Payments');
    const router = renderAt(`/deck/new?folder=${folder.id}`);
    await screen.findByRole('toolbar', { name: 'Deck' });
    const decks = await db.decks.toArray();
    expect(decks).toHaveLength(1);
    expect(decks[0]).toMatchObject({ name: 'Untitled deck', folderId: folder.id });
    expect(router.state.location.pathname).toBe(`/deck/${decks[0]?.id ?? ''}`);
    expect(screen.getByRole('button', { name: 'Rename deck' })).toHaveTextContent('Untitled deck');
  });

  it('renders "Deck not found" for an unknown id', async () => {
    renderAt('/deck/nope');
    expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to library' })).toHaveAttribute('href', '/');
  });

  it('explains that a deck stored by an earlier build cannot be opened (036 FR-027)', async () => {
    await insertDeck(db, deckRecord('old', { name: 'Old deck' }), legacyDeckBytes());
    renderAt('/deck/old');
    expect(
      await screen.findByRole('heading', { name: "This deck can't be opened" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This deck was saved by an earlier development build and can't be opened. Import its exported .sododeck file again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to library' })).toHaveAttribute('href', '/');
  });

  it('frees a note a deck stored before ADR 0041 still pins, where it was shown', async () => {
    const free: SododeckFile = {
      ...emptySododeckFile(),
      name: 'Pinned',
      nodes: [{ id: 'svc', type: 'service', title: 'Orders', position: { x: 100, y: 200 } }],
      stickies: [{ id: 'pinned', text: 'Owns PII.', position: { x: 0, y: 0 } }],
    };
    const bytes = pinnedNoteDeckBytes(Y.encodeStateAsUpdate(fromJSON(free)));
    await insertDeck(db, deckRecord('pinned', { name: 'Pinned' }), bytes);
    renderAt('/deck/pinned');
    await screen.findByRole('toolbar', { name: 'Deck' });
    const doc = opened.editor?.doc;
    if (!doc) throw new Error('editor not mounted');
    await waitFor(() => {
      expect(toJSON(doc).stickies).toEqual([
        { id: 'pinned', text: 'Owns PII.', position: { x: 110, y: 180 } },
      ]);
    });
    // A load-time fix, not an edit: nothing to undo.
    expect(opened.editor?.canUndo()).toBe(false);
  });

  it('keeps the demo deck in memory', async () => {
    renderAt('/deck/demo');
    expect(await screen.findByText('Demo · not saved')).toBeInTheDocument();
    act(() => {
      opened.editor?.add('nodes', { type: 'service', title: 'X' });
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(await db.decks.count()).toBe(0);
    expect(await db.updates.count()).toBe(0);
  });

  it('renders a stored deck, records the open and leaves the edit time alone', async () => {
    const { doc } = await openEditor({
      ...emptySododeckFile(),
      name: 'Shop',
      nodes: [{ id: 'a', type: 'service', title: 'Orders', position: { x: 0, y: 0 } }],
    });
    expect(toJSON(doc).nodes.map((n) => n.title)).toEqual(['Orders']);
    expect(opened.editor?.canUndo()).toBe(false);
    // The deck's STORAGE section lives in Deck settings (the drawer on the deck, 018).
    act(() => {
      ui().openDrawer('deck');
    });
    // Deck settings open on Database (founder feedback 2026-10-06).
    fireEvent.click(screen.getByRole('tab', { name: 'General' }));
    expect(screen.getByText('Stored in this browser')).toBeInTheDocument();
    await waitFor(async () => {
      expect((await record())?.openedAt).not.toBeNull();
    });
    expect((await record())?.updatedAt).toBe(5);
  });

  it('autosaves an edit and shows the status', async () => {
    await openEditor();
    act(() => {
      opened.editor?.add('nodes', { type: 'service', title: 'Saved node' });
    });
    // A quick write never shows "Saving…" (051 US6): the status stays saved.
    expect(screen.queryByText('Saving…')).toBeNull();
    expect(screen.getByText('Saved in this browser')).toBeInTheDocument();
    await waitFor(async () => {
      expect((await record())?.nodeCount).toBe(1);
    });
    expect(screen.queryByText('Saving…')).toBeNull();
  });

  it('saves at once on ⌘S without the browser dialog', async () => {
    await openEditor();
    act(() => {
      opened.editor?.add('nodes', { type: 'service', title: 'Now' });
    });
    expect(fireEvent.keyDown(document.body, { key: 's', metaKey: true })).toBe(false);
    await waitFor(async () => {
      expect((await record())?.nodeCount).toBe(1);
    });
  });

  it('exports <name>.sododeck from the deck menu dialog', async () => {
    const downloadText = vi.spyOn(download, 'downloadText').mockImplementation(() => undefined);
    const file = { ...emptySododeckFile(), name: 'Shop' };
    const { user } = await openEditor(file);
    await user.click(screen.getByRole('button', { name: 'Deck menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export…' }));
    await screen.findByRole('dialog', { name: 'Export deck' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(downloadText).toHaveBeenCalledWith(
      'shop.sododeck',
      serializeDeck(file),
      'application/json',
    );
    await waitFor(async () => {
      expect((await record())?.exportedAt).not.toBeNull();
    });
  });

  it('offers to keep a copy when another tab deletes the open deck', async () => {
    const { user, router } = await openEditor({
      ...emptySododeckFile(),
      name: 'Shop',
      nodes: [{ id: 'a', type: 'service', title: 'Orders' }],
    });
    act(() => {
      opened.editor?.add('nodes', { id: 'b', type: 'database', title: 'Unsaved here' });
    });
    await act(async () => {
      await softDeleteDeck(db, 'd1');
    });
    const dialog = await screen.findByRole('alertdialog', {
      name: 'This deck was deleted in another tab',
    });
    expect(within(dialog).getByRole('button', { name: 'Back to library' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Keep a copy' }));

    await waitFor(() => {
      expect(router.state.location.pathname).not.toBe('/deck/d1');
    });
    const copyId = router.state.location.pathname.replace('/deck/', '');
    const log = await loadDeckLog(db, copyId);
    const copy = new Y.Doc();
    for (const bytes of log?.bytes ?? []) Y.applyUpdate(copy, bytes);
    expect(toJSON(copy).nodes.map((n) => n.title)).toEqual(['Orders', 'Unsaved here']);
    expect(toJSON(copy).name).toBe('Shop');
  });

  it('shows a rename made in a library tab at once', async () => {
    await openEditor({ ...emptySododeckFile(), name: 'Shop' });
    await act(async () => {
      await renameDeck({ db, client: inProcessLibraryClient() }, 'd1', 'Store');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Rename deck' })).toHaveTextContent('Store');
    });
  });

  describe('rule editor route (008 FR-018)', () => {
    const withRule: SododeckFile = {
      ...emptySododeckFile(),
      name: 'Logistics',
      nodes: [
        { id: 'a', type: 'service', title: 'Pricing', position: { x: 0, y: 0 } },
        { id: 'b', type: 'database', title: 'Prices', position: { x: 300, y: 0 } },
      ],
      rules: {
        R: { title: 'Delivery tier', hitPolicy: 'first', inputs: [], outputs: [], rows: [] },
      },
    };

    it('opens Rules from the rail and comes back with the selection, drawer and viewport', async () => {
      const { router, user } = await openEditor(withRule);
      act(() => {
        ui().select({ nodes: ['a'] });
        ui().openDrawer();
      });
      await openRulesFromRail(user);
      expect(router.state.location.pathname).toBe('/deck/d1/rules');
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Rules');
      expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
      const saved = ui().canvasViewport;
      expect(saved).not.toBeNull();
      await user.click(screen.getByRole('link', { name: /Delivery tier/ }));
      expect(router.state.location.pathname).toBe('/deck/d1/rules/R');
      expect(screen.getByRole('textbox', { name: 'Rule name' })).toHaveValue('Delivery tier');

      await user.click(screen.getByRole('link', { name: 'Back to canvas' }));
      expect(router.state.location.pathname).toBe('/deck/d1');
      expect(screen.getByRole('heading', { name: 'Pricing' })).toBeInTheDocument();
      expect(ui().selection).toEqual({
        nodes: ['a'],
        edges: [],
        groups: [],
        stickies: [],
        images: [],
      });
      await openRulesFromRail(user);
      expect(ui().canvasViewport).toEqual(saved);
    });

    it('opens a rule directly from its address (a reload returns to it)', async () => {
      await insertDeck(
        db,
        deckRecord('d1', { name: 'Logistics', updatedAt: 5 }),
        Y.encodeStateAsUpdate(fromJSON(withRule)),
      );
      renderAt('/deck/d1/rules/R');
      expect(await screen.findByRole('textbox', { name: 'Rule name' })).toHaveValue(
        'Delivery tier',
      );
    });

    it('keeps Delete away from the canvas selection on the rules screen', async () => {
      const { user } = await openEditor(withRule);
      act(() => {
        ui().select({ nodes: ['a'] });
      });
      await openRulesFromRail(user);
      (document.activeElement as HTMLElement | null)?.blur();
      await user.keyboard('{Delete}');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(ui().pendingDelete).toBeNull();
      await user.keyboard('{Escape}');
      expect(ui().selection).toEqual({
        nodes: ['a'],
        edges: [],
        groups: [],
        stickies: [],
        images: [],
      });
    });

    it("opens the rule editor from Deck settings' Rules count", async () => {
      const { router, user } = await openEditor(withRule);
      await user.click(screen.getByRole('button', { name: 'Deck menu' }));
      await user.click(screen.getByRole('menuitem', { name: 'Deck settings' }));
      await user.click(screen.getByRole('tab', { name: 'General' }));
      await user.click(screen.getByRole('button', { name: 'Rules 1' }));
      expect(router.state.location.pathname).toBe('/deck/d1/rules');
    });
  });
});
