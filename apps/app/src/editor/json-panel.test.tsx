import { serializeDeck, toJSON, type DeckEditor } from '@sododeck/model';
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
  return { ...view, editor, doc, deckText };
}

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
