import { emptyDeckText } from '@sododeck/model';
import { PROTOCOL_VERSION } from '@sododeck/host-protocol';
import { describe, expect, it } from 'vitest';

import { deckText, noteOf, open, openReady, settle } from './harness';

const PLAIN = 'docs/Shop.sododeck';
const NOTE = 'docs/Shop.sododeck.md';

describe('open (US1)', () => {
  it('answers ready with init: text, theme, capabilities, protocol version', async () => {
    const h = await openReady(PLAIN, deckText());
    expect(h.editor.of('init')).toEqual([
      {
        type: 'init',
        protocolVersion: PROTOCOL_VERSION,
        text: deckText(),
        theme: 'light',
        capabilities: { openLinks: false, exportFiles: false, pictures: false },
      },
    ]);
    expect(h.editor.allSentAreValid()).toBe(true);
  });

  it('declares pictures only for a note with the attachment setting', async () => {
    const note = await openReady(NOTE, noteOf(deckText()));
    expect(note.editor.of('init')[0]?.capabilities.pictures).toBe(true);
    const embedded = await openReady(NOTE, noteOf(deckText()), (f) => {
      f.setPictureStorage('embedded');
    });
    expect(embedded.editor.of('init')[0]?.capabilities.pictures).toBe(false);
  });

  it('opens an empty file as the empty deck and writes nothing (FR-004, FR-009)', async () => {
    for (const [path, text] of [
      [PLAIN, ''],
      [PLAIN, '  \n'],
      [NOTE, '---\nsododeck-plugin: parsed\n---\n'],
    ] as const) {
      const h = await openReady(path, text);
      expect(h.editor.of('init')[0]?.text).toBe(emptyDeckText());
      expect(h.vault.calls.filter((c) => c.startsWith('writeText'))).toEqual([]);
      expect(h.file()).toBe(text);
    }
  });

  it('sends an invalid deck as init too and writes nothing (FR-004)', async () => {
    const h = await openReady(PLAIN, '{"version": 1, "nodes": 7}');
    expect(h.editor.of('init')[0]?.text).toBe('{"version": 1, "nodes": 7}');
    expect(h.vault.calls.filter((c) => c.startsWith('writeText'))).toEqual([]);
  });

  it('refuses a version mismatch without deck content and says which side to update (FR-005)', async () => {
    const h = open(PLAIN, deckText());
    h.editor.ready(PROTOCOL_VERSION + 1);
    await settle();
    expect(h.editor.of('init')[0]).toMatchObject({ text: '', protocolVersion: PROTOCOL_VERSION });
    expect(h.notices.join()).toMatch(/Update the Sododeck plugin/);
    h.editor.sendChange(deckText('Other'));
    await settle();
    expect(h.file()).toBe(deckText());
  });

  it('ignores a message that is not the protocol, and unknown messages (FR-035)', async () => {
    const h = await openReady(PLAIN, deckText());
    h.editor.raw({ type: 'change', seq: -1, text: 5 });
    h.editor.raw({ type: 'rm-rf' });
    h.editor.raw('hello');
    h.editor.raw(null);
    await settle();
    expect(h.file()).toBe(deckText());
    expect(h.editor.of('change-result')).toEqual([]);
  });

  it('shows an error pane for a note whose deck block cannot be read, and no canvas content', async () => {
    const h = await openReady(
      NOTE,
      '---\nsododeck-plugin: parsed\n---\n%% sododeck:begin %%\n%% sododeck:end %%\n',
    );
    expect(h.editor.of('init')).toEqual([]);
    expect(h.errorPanes).toHaveLength(1);
    expect(h.errorPanes[0]?.[0]?.message).toMatch(/deck data/);
  });
});

describe('autosave (US1)', () => {
  it('writes a change once and acknowledges it', async () => {
    const h = await openReady(PLAIN, deckText());
    const next = deckText('Shop', 'Orders v2');
    const seq = h.editor.sendChange(next);
    await settle();
    expect(h.file()).toBe(next);
    expect(h.vault.calls.filter((c) => c.startsWith('writeText'))).toHaveLength(1);
    expect(h.editor.of('change-result')).toEqual([{ type: 'change-result', seq, ok: true }]);
  });

  it('writes a note through the Markdown form, keeping the user text', async () => {
    const note = `${noteOf(deckText())}\nmy own text\n`;
    const h = await openReady(NOTE, note);
    h.editor.sendChange(deckText('Shop', 'Orders v2'));
    await settle();
    expect(h.file()).toContain('### Orders v2 %%a%%');
    expect(h.file().endsWith('\nmy own text\n')).toBe(true);
  });

  it('coalesces a burst of changes behind a write in flight (FR-006, SC-013)', async () => {
    const h = await openReady(PLAIN, deckText());
    h.vault.holdWrites = true;
    let last = 0;
    for (let i = 0; i < 20; i++) last = h.editor.sendChange(deckText('Shop', `T${String(i)}`));
    await settle();
    expect(h.vault.writesWaiting).toBe(1);
    h.vault.holdWrites = false;
    h.vault.releaseWrites();
    await settle();
    expect(h.vault.calls.filter((c) => c.startsWith('writeText')).length).toBeLessThanOrEqual(2);
    expect(h.file()).toBe(deckText('Shop', 'T19'));
    expect(h.editor.of('change-result').at(-1)).toEqual({
      type: 'change-result',
      seq: last,
      ok: true,
    });
  });

  it('does not write a change that equals the file, but acknowledges it (FR-013)', async () => {
    const h = await openReady(PLAIN, deckText());
    const seq = h.editor.sendChange(deckText());
    await settle();
    expect(h.vault.calls.filter((c) => c.startsWith('writeText'))).toEqual([]);
    expect(h.editor.of('change-result')).toEqual([{ type: 'change-result', seq, ok: true }]);
  });

  it('never writes for theme changes or outside changes (FR-009)', async () => {
    const h = await openReady(PLAIN, deckText());
    h.setScheme('dark');
    h.vault.externalWrite(PLAIN, deckText('Shop', 'Else'));
    await settle();
    expect(h.vault.calls.filter((c) => c.startsWith('writeText'))).toEqual([]);
  });

  it('reports a failed write, keeps the text and retries on the next change (FR-010)', async () => {
    const h = await openReady(PLAIN, deckText());
    h.vault.failWrites = 'disk full';
    const seq = h.editor.sendChange(deckText('Shop', 'One'));
    await settle();
    expect(h.editor.of('change-result')).toEqual([
      { type: 'change-result', seq, ok: false, reason: 'disk full' },
    ]);
    expect(h.notices.join()).toMatch(/could not save "Shop.sododeck": disk full/);
    expect(h.file()).toBe(deckText());
    h.vault.failWrites = null;
    h.editor.sendChange(deckText('Shop', 'Two'));
    await settle();
    expect(h.file()).toBe(deckText('Shop', 'Two'));
  });
});
