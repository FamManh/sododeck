import { inspectDeckText, type DeckEditor } from '@sododeck/model';
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as EditorContextModule from '../model/editor-context';
import { EditorProbe } from '../test/editor-probe';
import { useUiStore } from '../state/ui-store';
import { changes, mountEmbed, opened, sampleText, SAMPLE } from './embed-test-kit';

// Monaco does not run in jsdom; the JSON panel has its own coverage.
vi.mock('../editor/json-panel', () => ({ JsonPanel: () => null }));

// The embed's own editor (the one that owns the undo history), for edits from the test.
vi.mock('../model/editor-context', async (importOriginal) => {
  const actual = await importOriginal<typeof EditorContextModule>();
  return {
    EditorProvider: ({ doc, children }: Parameters<typeof actual.EditorProvider>[0]) => (
      <actual.EditorProvider doc={doc}>
        <EditorProbe
          onEditor={(editor: DeckEditor) => {
            opened.editor = editor;
          }}
        />
        {children}
      </actual.EditorProvider>
    ),
  };
});

beforeEach(() => {
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  vi.useRealTimers();
});

/** A card by its title; the accessible name is "<Type>: <title>", plus ", n problems" if any. */
const card = (title: string) =>
  screen.getByRole('group', { name: new RegExp(`: ${title}(, \\d+ problems?)?$`) });

describe('EmbedApp opens a deck (067 US1)', () => {
  it('says ready, then shows the host’s deck on the canvas', async () => {
    const { host } = mountEmbed();
    await screen.findByRole('toolbar', { name: 'Deck' });
    expect(host.log[0]).toMatchObject({
      dir: 'in',
      message: { type: 'ready', protocolVersion: 1 },
    });
    expect(card('Billing API')).toBeInTheDocument();
    expect(card('Orders DB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename deck' })).toHaveTextContent('Shop');
  });

  it('follows the host’s theme without remounting the canvas', async () => {
    const { host } = mountEmbed({ theme: 'dark' });
    await screen.findByRole('toolbar', { name: 'Deck' });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    const canvas = card('Billing API');
    act(() => {
      host.setTheme('light');
    });
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
    expect(card('Billing API')).toBe(canvas);
  });

  it('offers no library, home, new, open or import-file controls', async () => {
    mountEmbed();
    await screen.findByRole('toolbar', { name: 'Deck' });
    for (const name of [
      'Open library',
      'New deck',
      'Open deck',
      'Import deck file',
      'Duplicate',
      'All decks',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
  });

  it('opens an empty file as an empty deck whose first edit is a valid file', async () => {
    const { host } = mountEmbed({ text: '' });
    await screen.findByRole('toolbar', { name: 'Deck' });
    expect(screen.getByRole('heading', { name: 'Start your diagram' })).toBeInTheDocument();
    act(() => {
      opened.editor?.updateMeta({ name: 'Fresh' });
    });
    await waitFor(() => {
      expect(changes(host)).toHaveLength(1);
    });
    const text = host.lastText() ?? '';
    expect(inspectDeckText(text).ok).toBe(true);
    expect(text).toContain('"name": "Fresh"');
  });

  it('shows the problems of an invalid first file and sends no change', async () => {
    // A repeated id refuses the file (a dangling reference only opens it with a problem).
    const broken = sampleText({
      nodes: [
        { id: 'api', type: 'service', title: 'Billing API', position: { x: 0, y: 0 } },
        { id: 'api', type: 'service', title: 'Again', position: { x: 0, y: 0 } },
      ],
    });
    const { host } = mountEmbed({ text: broken });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'This deck file has problems, so it is shown as it was. Fix the file to keep editing here.',
    );
    expect(screen.getByRole('list', { name: 'Problems in the deck file' })).toHaveTextContent(
      /api/,
    );
    expect(screen.queryByRole('toolbar', { name: 'Deck' })).not.toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(changes(host)).toHaveLength(0);
    // The first valid file opens it.
    act(() => {
      host.sendExternal(sampleText());
    });
    await screen.findByRole('toolbar', { name: 'Deck' });
    expect(card('Billing API')).toBeInTheDocument();
  });

  it('says the host sent no deck after 10 seconds, and still opens a later init', async () => {
    vi.useFakeTimers();
    const { host } = mountEmbed({ autoInit: false });
    expect(screen.getByRole('status')).toHaveTextContent('Opening deck…');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'The program hosting this editor did not send a deck',
    );
    act(() => {
      host.sendInit();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    vi.useRealTimers();
    expect(await screen.findByRole('toolbar', { name: 'Deck' })).toBeInTheDocument();
    expect(card('Billing API')).toBeInTheDocument();
    expect(SAMPLE.nodes).toHaveLength(2);
  });
});

/** Moves a card the way a drag ends: one write through the editor. */
function moveCard(id: string, x: number, y: number) {
  act(() => {
    opened.editor?.update('nodes', id, { position: { x, y } });
  });
}

describe('EmbedApp sends edits to the host (067 US2)', () => {
  it('sends the moved card as a complete, valid file', async () => {
    const { host } = mountEmbed();
    await screen.findByRole('toolbar', { name: 'Deck' });
    moveCard('api', 200, 80);
    await waitFor(() => {
      expect(changes(host)).toHaveLength(1);
    });
    const text = host.lastText() ?? '';
    expect(inspectDeckText(text).ok).toBe(true);
    const file = JSON.parse(text) as { nodes: { id: string; position: unknown }[] };
    expect(file.nodes.find((n) => n.id === 'api')?.position).toEqual({ x: 200, y: 80 });
    expect(file.nodes.find((n) => n.id === 'db')?.position).toEqual({ x: 320, y: 0 });
  });

  it('shows the host’s reason when it refuses a change, and clears it on the next ok', async () => {
    const { host } = mountEmbed();
    await screen.findByRole('toolbar', { name: 'Deck' });
    host.refuseNextChange('Disk full');
    moveCard('api', 10, 10);
    expect(await screen.findByRole('alert')).toHaveTextContent('Disk full');
    moveCard('api', 20, 20);
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('answers a flush after the pending change was sent', async () => {
    const { host } = mountEmbed();
    await screen.findByRole('toolbar', { name: 'Deck' });
    moveCard('api', 5, 5);
    await host.flush();
    const types = host.log.flatMap((e) => (e.dir === 'in' ? [e.message.type] : []));
    expect(types.slice(-2)).toEqual(['change', 'flushed']);
  });

  it('shows no save state at all', async () => {
    const { host } = mountEmbed();
    await screen.findByRole('toolbar', { name: 'Deck' });
    moveCard('api', 5, 5);
    await waitFor(() => {
      expect(changes(host)).toHaveLength(1);
    });
    expect(screen.queryByText(/Saved|Saving|Demo · not saved/)).not.toBeInTheDocument();
  });
});

const RENAMED = () =>
  sampleText({
    nodes: [
      { id: 'api', type: 'service', title: 'Billing API', position: { x: 0, y: 0 } },
      { id: 'db', type: 'database', title: 'Orders Store', position: { x: 320, y: 0 } },
    ],
  });

const BROKEN = () =>
  sampleText({
    nodes: [
      { id: 'api', type: 'service', title: 'Billing API', position: { x: 0, y: 0 } },
      { id: 'api', type: 'service', title: 'Again', position: { x: 0, y: 0 } },
    ],
  });

const viewport = () =>
  document.querySelector<HTMLElement>('.react-flow__viewport')?.style.transform ?? '';

const settle = (ms = 500) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

describe('EmbedApp merges outside changes (067 US3)', () => {
  it('renames in place, keeps the selection and viewport, and sends nothing back', async () => {
    const { host } = mountEmbed();
    await screen.findByRole('toolbar', { name: 'Deck' });
    act(() => {
      useUiStore.getState().select({ nodes: ['api'] });
    });
    expect(card('Billing API')).toHaveAttribute('aria-selected', 'true');
    const before = viewport();
    act(() => {
      host.sendExternal(RENAMED());
    });
    expect(await screen.findByRole('group', { name: /Orders Store/ })).toBeInTheDocument();
    expect(card('Billing API')).toHaveAttribute('aria-selected', 'true');
    expect(viewport()).toBe(before);
    await settle();
    expect(changes(host)).toHaveLength(0);
  });

  it('keeps the user’s undo history: undo removes only the user’s edit', async () => {
    const { host } = mountEmbed();
    await screen.findByRole('toolbar', { name: 'Deck' });
    moveCard('api', 200, 80);
    await waitFor(() => {
      expect(changes(host)).toHaveLength(1);
    });
    act(() => {
      host.sendExternal(
        sampleText({
          nodes: [
            { id: 'api', type: 'service', title: 'Billing API', position: { x: 200, y: 80 } },
            { id: 'db', type: 'database', title: 'Orders Store', position: { x: 320, y: 0 } },
          ],
        }),
      );
    });
    await screen.findByRole('group', { name: /Orders Store/ });
    act(() => {
      expect(opened.editor?.undo()).toBe(true);
    });
    // The move is undone, the outside rename stays.
    expect(card('Orders Store')).toBeInTheDocument();
    await waitFor(() => {
      const file = JSON.parse(host.lastText() ?? '{}') as {
        nodes: { id: string; position: unknown }[];
      };
      expect(file.nodes.find((n) => n.id === 'api')?.position).toEqual({ x: 0, y: 0 });
    });
    act(() => {
      expect(opened.editor?.undo()).toBe(false);
    });
  });

  it('ignores the host echoing back what the editor sent', async () => {
    const { host } = mountEmbed();
    await screen.findByRole('toolbar', { name: 'Deck' });
    moveCard('api', 200, 80);
    await waitFor(() => {
      expect(changes(host)).toHaveLength(1);
    });
    const sent = host.lastText() ?? '';
    act(() => {
      host.sendExternal(sent);
    });
    await settle();
    expect(changes(host)).toHaveLength(1);
    expect(card('Billing API')).toBeInTheDocument();
  });

  it('makes the editor read-only on an invalid outside file, until a valid one arrives', async () => {
    const { host } = mountEmbed();
    await screen.findByRole('toolbar', { name: 'Deck' });
    act(() => {
      useUiStore.getState().select({ nodes: ['api'] });
    });
    act(() => {
      host.sendExternal(BROKEN());
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This deck file has problems');
    expect(screen.getByTestId('embed-editor')).toHaveAttribute('inert');
    // The deck stays on screen as it was; the edit keys do nothing.
    expect(card('Billing API')).toBeInTheDocument();
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    });
    // The card is still there: Delete reached nothing.
    expect(opened.editor?.doc && card('Billing API')).toBeTruthy();
    await settle();
    expect(changes(host)).toHaveLength(0);
    await host.flush();

    act(() => {
      host.sendExternal(RENAMED());
    });
    await screen.findByRole('group', { name: /Orders Store/ });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('embed-editor')).not.toHaveAttribute('inert');
    moveCard('api', 40, 40);
    await waitFor(() => {
      expect(changes(host)).toHaveLength(1);
    });
  });

  it('treats a second init as an outside change', async () => {
    const { host } = mountEmbed();
    await screen.findByRole('toolbar', { name: 'Deck' });
    host.options.text = RENAMED();
    act(() => {
      host.sendInit();
    });
    expect(await screen.findByRole('group', { name: /Orders Store/ })).toBeInTheDocument();
    await settle();
    expect(changes(host)).toHaveLength(0);
  });
});
