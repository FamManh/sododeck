// @vitest-environment jsdom
import { PROTOCOL_VERSION } from '@sododeck/host-protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeckView } from '../src/deck-view';
import { SettingsHub } from '../src/obsidian-ports';
import { deckText, noteOf } from './harness';
import { FakeApp, TFile } from './fake-obsidian';
import { settle } from './fake-editor';

afterEach(() => {
  document.body.innerHTML = '';
});

function openView(path: string, text: string) {
  const app = new FakeApp();
  app.files.set(path, text);
  const view = new DeckView({ app } as never, new SettingsHub(() => 'attachments'));
  view.file = new TFile(path) as never;
  return { app, view };
}

function frameOf(view: DeckView): { sent: unknown[]; fromFrame(data: unknown): void } {
  const iframe = view.contentEl.querySelector('iframe');
  if (iframe === null || iframe.contentWindow === null) throw new Error('no frame');
  const sent: unknown[] = [];
  vi.spyOn(iframe.contentWindow, 'postMessage').mockImplementation((message: unknown) => {
    sent.push(message);
  });
  return {
    sent,
    fromFrame(data) {
      window.dispatchEvent(new MessageEvent('message', { data, source: iframe.contentWindow }));
    },
  };
}

describe('DeckView (glue)', () => {
  it('shows the frame, answers ready with init, and writes a change once through the vault', async () => {
    const { app, view } = openView('Shop.sododeck', deckText());
    view.setViewData(deckText(), true);
    const frame = frameOf(view);
    frame.fromFrame({ type: 'ready', protocolVersion: PROTOCOL_VERSION, editorVersion: '1' });
    await settle();
    expect(frame.sent[0]).toMatchObject({ type: 'init', text: deckText(), theme: 'light' });

    const next = deckText('Shop', 'Orders v2');
    frame.fromFrame({ type: 'change', seq: 0, text: next });
    await settle();
    expect(app.modifies).toEqual([{ path: 'Shop.sododeck', text: next }]);
    expect(frame.sent.at(-1)).toEqual({ type: 'change-result', seq: 0, ok: true });
    expect(view.getViewData()).toBe(next);
  });

  it('does not echo its own write when the app reloads the file into the view', async () => {
    const { view } = openView('Shop.sododeck', deckText());
    view.setViewData(deckText(), true);
    const frame = frameOf(view);
    frame.fromFrame({ type: 'ready', protocolVersion: PROTOCOL_VERSION, editorVersion: '1' });
    await settle();
    const next = deckText('Shop', 'Orders v2');
    frame.fromFrame({ type: 'change', seq: 0, text: next });
    await settle();
    view.setViewData(next, false);
    await settle();
    expect(frame.sent.filter((m) => (m as { type: string }).type === 'external-change')).toEqual(
      [],
    );
  });

  it('shows an outside change that the app reloads into the view', async () => {
    const { view } = openView('Shop.sododeck', deckText());
    view.setViewData(deckText(), true);
    const frame = frameOf(view);
    frame.fromFrame({ type: 'ready', protocolVersion: PROTOCOL_VERSION, editorVersion: '1' });
    await settle();
    view.setViewData(deckText('Shop', 'Else'), false);
    await settle();
    expect(frame.sent.at(-1)).toEqual({ type: 'external-change', text: deckText('Shop', 'Else') });
  });

  it('flushes on unload, then removes the frame', async () => {
    const { app, view } = openView('Shop.sododeck', deckText());
    view.setViewData(deckText(), true);
    const frame = frameOf(view);
    frame.fromFrame({ type: 'ready', protocolVersion: PROTOCOL_VERSION, editorVersion: '1' });
    await settle();
    const closing = view.onUnloadFile(view.file as never);
    await settle();
    const flush = frame.sent.find((m) => (m as { type: string }).type === 'flush') as {
      requestId: string;
    };
    expect(flush).toBeDefined();
    frame.fromFrame({ type: 'change', seq: 0, text: deckText('Shop', 'Last') });
    frame.fromFrame({ type: 'flushed', requestId: flush.requestId });
    await closing;
    expect(app.modifies.at(-1)?.text).toBe(deckText('Shop', 'Last'));
    expect(view.contentEl.querySelector('iframe')).toBeNull();
  });

  it('shows an error pane with an Open as Markdown action for a note it cannot read', async () => {
    const broken = '---\nsododeck-plugin: parsed\n---\n%% sododeck:begin %%\n%% sododeck:end %%\n';
    const { view } = openView('Shop.sododeck.md', broken);
    view.setViewData(broken, true);
    const frame = frameOf(view);
    frame.fromFrame({ type: 'ready', protocolVersion: PROTOCOL_VERSION, editorVersion: '1' });
    await settle();
    const pane = view.contentEl.querySelector('.sododeck-error');
    expect(pane?.textContent).toMatch(/cannot be shown/);
    expect(pane?.querySelector('button')?.textContent).toBe('Open as Markdown');
    expect(frame.sent).toEqual([]);
  });

  it('reads a note through the Markdown form', async () => {
    const note = noteOf(deckText());
    const { view } = openView('Shop.sododeck.md', note);
    view.setViewData(note, true);
    const frame = frameOf(view);
    frame.fromFrame({ type: 'ready', protocolVersion: PROTOCOL_VERSION, editorVersion: '1' });
    await settle();
    expect(frame.sent[0]).toMatchObject({ type: 'init', text: deckText() });
  });

  it('a different file clears the old frame', () => {
    const { view } = openView('A.sododeck', deckText());
    view.setViewData(deckText(), true);
    view.setViewData(deckText('Other'), true);
    expect(view.contentEl.querySelectorAll('iframe')).toHaveLength(1);
  });
});
