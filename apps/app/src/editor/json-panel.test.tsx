import {
  serializeDeck,
  serializeEntries,
  serializeEntry,
  toJSON,
  type DeckEditor,
} from '@sododeck/model';
import userEvent from '@testing-library/user-event';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { editorWrapper } from '../test/render-canvas';
import { useUiStore } from '../state/ui-store';
import { demoDeck } from './demo-deck';
import { JsonPanel } from './json-panel';
import { countLines, lineCountLabel } from './json-panel-view';

// Monaco does not run in jsdom: a double shows the text in a labelled <pre> and exposes the
// viewer callbacks as buttons.
vi.mock('./json-viewer', () => ({
  default: ({
    text,
    ariaLabel,
    onReadOnlyAttempt,
    onUndo,
    onRedo,
  }: {
    text: string;
    ariaLabel: string;
    onReadOnlyAttempt: () => void;
    onUndo: () => void;
    onRedo: () => void;
  }) => (
    <div>
      <pre aria-label={ariaLabel}>{text}</pre>
      <button type="button" onClick={onReadOnlyAttempt}>
        Attempt edit
      </button>
      <button type="button" onClick={onUndo}>
        Viewer undo
      </button>
      <button type="button" onClick={onRedo}>
        Viewer redo
      </button>
    </div>
  ),
}));

function setup() {
  const { wrapper, editor, doc } = editorWrapper(demoDeck);
  const view = render(<JsonPanel />, { wrapper });
  const deckText = () => serializeDeck(toJSON(doc));
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  return { ...view, editor, doc, deckText, user };
}

const nodeOf = (id: string, doc: Parameters<typeof toJSON>[0]) => {
  const node = toJSON(doc).nodes.find((n) => n.id === id);
  if (!node) throw new Error(`no node ${id}`);
  return node;
};

/** Lets the throttled Deck text catch up. */
function flush() {
  act(() => {
    vi.advanceTimersByTime(300);
  });
}

const deckPre = () => screen.findByLabelText('Deck JSON, read-only');

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('JsonPanel — Deck tab (US2)', () => {
  it('opens on the Deck tab with the read-only status and a line count', async () => {
    const { deckText } = setup();
    const region = screen.getByRole('region', { name: 'JSON' });
    const tabs = within(region).getByRole('radiogroup', { name: 'JSON view' });
    expect(within(tabs).getByRole('radio', { name: 'Deck' })).toBeChecked();
    expect(within(region).getByText('Read-only · synced with canvas')).toBeVisible();
    expect(await deckPre()).toHaveTextContent(deckText().trim(), { normalizeWhitespace: false });
    expect(within(region).getByText(lineCountLabel(countLines(deckText())))).toBeInTheDocument();
  });

  it('follows every change: add, remove, undo and redo', async () => {
    const { editor, deckText } = setup();
    const pre = await deckPre();
    const expectSynced = () => {
      flush();
      expect(pre.textContent).toBe(deckText());
    };
    const e: () => DeckEditor = editor;
    let id = '';
    act(() => {
      id = e().add('nodes', { type: 'service', title: 'Billing' });
    });
    expectSynced();
    expect(pre.textContent).toContain('"Billing"');
    act(() => {
      e().remove('nodes', id);
    });
    expectSynced();
    expect(pre.textContent).not.toContain('"Billing"');
    act(() => {
      e().undo();
    });
    expectSynced();
    expect(pre.textContent).toContain('"Billing"');
    act(() => {
      e().redo();
    });
    expectSynced();
    expect(pre.textContent).not.toContain('"Billing"');
  });

  it('stays on Deck when the selection changes (clarification Q2)', async () => {
    setup();
    await deckPre();
    act(() => {
      useUiStore.getState().select({ nodes: ['web-app'] });
    });
    expect(screen.getByRole('radio', { name: 'Deck' })).toBeChecked();
    expect(await deckPre()).toBeInTheDocument();
  });
});

describe('JsonPanel — Selection tab (US1)', () => {
  const selectionPre = () => screen.getByLabelText('Selection JSON, read-only');
  const select = (selection: { nodes?: string[]; edges?: string[] }) => {
    act(() => {
      useUiStore.getState().select(selection);
    });
  };

  async function openSelectionTab() {
    const env = setup();
    await deckPre();
    await env.user.click(screen.getByRole('radio', { name: 'Selection' }));
    return env;
  }

  it('shows an empty state when nothing is selected', async () => {
    const { user } = await openSelectionTab();
    expect(
      screen.getByText('Select a component or connection to see its JSON.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Selection JSON, read-only')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ lines?$/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show Deck JSON' }));
    expect(screen.getByRole('radio', { name: 'Deck' })).toBeChecked();
    expect(await deckPre()).toBeInTheDocument();
  });

  it('shows the selected component as in the file, and follows its edits (US1-1, US1-2)', async () => {
    const { editor, doc } = await openSelectionTab();
    select({ nodes: ['order-svc'] });
    expect(screen.getByRole('radio', { name: 'Order Service' })).toBeChecked();
    expect((await screen.findByLabelText('Selection JSON, read-only')).textContent).toBe(
      serializeEntry('nodes', nodeOf('order-svc', doc)),
    );
    act(() => {
      editor().update('nodes', 'order-svc', { title: 'Renamed' });
    });
    expect(screen.getByRole('radio', { name: 'Renamed' })).toBeChecked();
    expect(selectionPre().textContent).toContain('"title": "Renamed"');
    act(() => {
      editor().update('nodes', 'order-svc', { position: { x: 12, y: 34 } });
    });
    expect(selectionPre().textContent).toBe(serializeEntry('nodes', nodeOf('order-svc', doc)));
    expect(selectionPre().textContent).toContain('"x": 12');
    act(() => {
      editor().undo();
    });
    expect(selectionPre().textContent).not.toContain('"x": 12');
  });

  it('names an unlabeled connection by its ends and follows its edits (US1-3)', async () => {
    const { editor, doc } = await openSelectionTab();
    let id = '';
    act(() => {
      id = editor().add('edges', { from: 'web-app', to: 'orders-db' });
    });
    select({ edges: [id] });
    expect(screen.getByRole('radio', { name: 'Web App → Orders DB' })).toBeChecked();
    act(() => {
      editor().update('edges', id, { protocol: 'grpc' });
    });
    const edge = toJSON(doc).edges.find((e) => e.id === id);
    expect((await screen.findByLabelText('Selection JSON, read-only')).textContent).toBe(
      serializeEntry('edges', edge),
    );
    expect(selectionPre().textContent).toContain('"protocol": "grpc"');
  });

  it('shows several items as one array, nodes first in deck order (US1-5, Q1)', async () => {
    const { doc } = await openSelectionTab();
    act(() => {
      const { toggle } = useUiStore.getState();
      toggle('e2', 'edge');
      toggle('orders-db', 'node');
      toggle('web-app', 'node');
      toggle('order-svc', 'node');
    });
    expect(screen.getByRole('radio', { name: '4 selected' })).toBeChecked();
    const file = toJSON(doc);
    const e2 = file.edges.find((e) => e.id === 'e2');
    expect((await screen.findByLabelText('Selection JSON, read-only')).textContent).toBe(
      serializeEntries([
        ...file.nodes.map((value) => ({ collection: 'nodes' as const, value })),
        { collection: 'edges', value: e2 },
      ]),
    );
  });

  it('shows the empty state once the selected component is deleted (US1-6)', async () => {
    const { editor } = await openSelectionTab();
    select({ nodes: ['orders-db'] });
    await screen.findByLabelText('Selection JSON, read-only');
    act(() => {
      editor().remove('nodes', 'orders-db');
    });
    expect(
      screen.getByText('Select a component or connection to see its JSON.'),
    ).toBeInTheDocument();
  });

  it('never switches tabs by itself (Q2)', async () => {
    setup();
    await deckPre();
    select({ nodes: ['web-app'] });
    expect(screen.getByRole('radio', { name: 'Deck' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Web App' })).not.toBeChecked();
  });
});

describe('JsonPanel — read-only (US3)', () => {
  const MESSAGE = 'Read-only. Edit on the canvas or in the inspector.';

  it('announces a refused edit at most once every 3 s, and the deck does not change', async () => {
    const { doc, user } = setup();
    await deckPre();
    const before = toJSON(doc);
    const announce = vi.spyOn(useUiStore.getState(), 'announce');
    useUiStore.setState({ announce });
    const attempt = screen.getByRole('button', { name: 'Attempt edit' });
    await user.click(attempt);
    await user.click(attempt);
    await user.click(attempt);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(MESSAGE);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    await user.click(attempt);
    expect(announce).toHaveBeenCalledTimes(2);
    expect(toJSON(doc)).toEqual(before);
  });

  it('shows the read-only state with an icon and text, not color alone', () => {
    setup();
    const status = screen.getByText('Read-only · synced with canvas');
    const icon = status.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('undoes and redoes deck edits from inside the viewer', async () => {
    const { editor, doc, user } = setup();
    await deckPre();
    act(() => {
      editor().add('nodes', { id: 'billing', type: 'service', title: 'Billing' });
    });
    await user.click(screen.getByRole('button', { name: 'Viewer undo' }));
    expect(toJSON(doc).nodes.some((n) => n.id === 'billing')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Viewer redo' }));
    expect(toJSON(doc).nodes.some((n) => n.id === 'billing')).toBe(true);
  });
});
