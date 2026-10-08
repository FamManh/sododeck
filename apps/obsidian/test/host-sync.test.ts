import { describe, expect, it } from 'vitest';

import { REPLACED_NOTICE } from '../src/host-session';
import { deckText, noteOf, open, openReady, settle } from './harness';

const PLAIN = 'docs/Shop.sododeck';
const NOTE = 'docs/Shop.sododeck.md';

const writes = (h: { vault: { calls: string[] } }) =>
  h.vault.calls.filter((c) => c.startsWith('writeText'));

describe('the canvas follows the file (US3)', () => {
  it('shows an outside change in place and sends nothing back (US3-1, SC-005)', async () => {
    const h = await openReady(PLAIN, deckText());
    h.vault.externalWrite(PLAIN, deckText('Shop', 'Else'));
    await settle();
    expect(h.editor.of('external-change')).toEqual([
      { type: 'external-change', text: deckText('Shop', 'Else') },
    ]);
    expect(writes(h)).toEqual([]);
    expect(h.editor.of('change-result')).toEqual([]);
  });

  it('does not echo its own write (US3-2)', async () => {
    const h = await openReady(PLAIN, deckText());
    h.editor.sendChange(deckText('Shop', 'Mine'));
    await settle();
    expect(h.editor.of('external-change')).toEqual([]);
    expect(writes(h)).toHaveLength(1);
  });

  it('does not echo an older own write that arrives while a newer text is queued', async () => {
    const h = await openReady(PLAIN, deckText());
    h.vault.holdWrites = true;
    h.editor.sendChange(deckText('Shop', 'One'));
    await settle();
    h.editor.sendChange(deckText('Shop', 'Two'));
    h.vault.holdWrites = false;
    h.vault.releaseWrites();
    await settle();
    expect(h.editor.of('external-change')).toEqual([]);
    expect(h.file()).toBe(deckText('Shop', 'Two'));
  });

  it('replaces edits not yet written, says so once, and writes the replaced text never (FR-020)', async () => {
    const h = await openReady(PLAIN, deckText());
    h.vault.failWrites = 'busy';
    h.editor.sendChange(deckText('Shop', 'Unsaved'));
    await settle();
    h.vault.failWrites = null;
    h.notices.length = 0;
    h.vault.externalWrite(PLAIN, deckText('Shop', 'FromDisk'));
    await settle();
    expect(h.notices).toEqual([REPLACED_NOTICE]);
    expect(h.editor.of('external-change').at(-1)?.text).toBe(deckText('Shop', 'FromDisk'));
    await h.session.flush();
    expect(h.file()).toBe(deckText('Shop', 'FromDisk'));
  });

  it('two panes on one deck settle after one write with no echo loop (US3-8, FR-023)', async () => {
    const a = await openReady(PLAIN, deckText());
    // A second session on the SAME vault and file.
    const { HostSession } = await import('../src/host-session');
    const { FakeEditor } = await import('./fake-editor');
    const editorB = new FakeEditor();
    const sessionB = new HostSession({
      path: PLAIN,
      fileText: deckText(),
      transport: editorB.host,
      ports: a.ports,
    });
    editorB.ready();
    await settle();
    a.editor.sendChange(deckText('Shop', 'FromA'));
    await settle();
    expect(editorB.of('external-change')).toEqual([
      { type: 'external-change', text: deckText('Shop', 'FromA') },
    ]);
    expect(editorB.of('change-result')).toEqual([]);
    expect(writes(a)).toHaveLength(1);
    expect(a.editor.of('external-change')).toEqual([]);
    sessionB.dispose();
  });

  it('follows a rename and writes to the new path', async () => {
    const h = await openReady(PLAIN, deckText());
    h.vault.externalRename(PLAIN, 'moved/Shop.sododeck');
    await settle();
    h.editor.sendChange(deckText('Shop', 'After'));
    await settle();
    expect(h.vault.text('moved/Shop.sododeck')).toBe(deckText('Shop', 'After'));
  });

  it('does not recreate a deleted deck (FR-022)', async () => {
    const h = await openReady(PLAIN, deckText());
    h.vault.externalDelete(PLAIN);
    await settle();
    h.editor.sendChange(deckText('Shop', 'Edit after delete'));
    await settle();
    expect(h.vault.paths()).toEqual([]);
    expect(h.editor.of('change-result').at(-1)).toMatchObject({ ok: false });
    expect(h.notices.join()).toMatch(/could not save/);
  });

  it('ignores a conflicted copy next to the deck', async () => {
    const h = await openReady(PLAIN, deckText());
    h.vault.externalCreate('docs/Shop (conflicted copy).sododeck', deckText('Shop', 'Other'));
    await settle();
    expect(h.editor.of('external-change')).toEqual([]);
  });

  it('keeps the canvas and writes nothing while the note cannot be read, then resumes (FR-021)', async () => {
    const note = noteOf(deckText());
    const h = await openReady(NOTE, note);
    h.vault.externalWrite(NOTE, note.replace(/```json[\s\S]*?```/, '```json\n{oops\n```'));
    await settle();
    expect(h.errorPanes).toHaveLength(1);
    expect(h.editor.of('external-change')).toEqual([]);
    h.editor.sendChange(deckText('Shop', 'Blocked'));
    await settle();
    expect(h.editor.of('change-result').at(-1)).toMatchObject({ ok: false });
    expect(writes(h)).toEqual([]);
    h.vault.externalWrite(NOTE, noteOf(deckText('Shop', 'Fixed')));
    await settle();
    expect(h.editor.of('external-change').at(-1)?.text).toBe(deckText('Shop', 'Fixed'));
    h.editor.sendChange(deckText('Shop', 'Fixed again'));
    await settle();
    expect(h.file()).toContain('### Fixed again %%a%%');
  });

  it('opens a note that was broken at the start once it is fixed', async () => {
    const broken = '---\nsododeck-plugin: parsed\n---\n%% sododeck:begin %%\n%% sododeck:end %%\n';
    const h = open(NOTE, broken);
    h.editor.ready();
    await settle();
    expect(h.editor.of('init')).toEqual([]);
    h.vault.externalWrite(NOTE, noteOf(deckText()));
    await settle();
    expect(h.editor.of('init')).toHaveLength(1);
    expect(h.editor.of('init')[0]?.text).toBe(deckText());
  });

  it('shows an invalid deck from disk read-only and writes nothing until it is valid (FR-021)', async () => {
    const h = await openReady(PLAIN, deckText());
    h.vault.externalWrite(PLAIN, '{ not json');
    await settle();
    expect(h.editor.of('external-change').at(-1)?.text).toBe('{ not json');
    expect(writes(h)).toEqual([]);
  });

  it('a note edited only outside the owned region sends nothing and keeps the text', async () => {
    const note = noteOf(deckText());
    const h = await openReady(NOTE, note);
    h.vault.externalWrite(NOTE, `${note}\nmy paragraph\n`);
    await settle();
    expect(h.editor.of('external-change')).toEqual([]);
    h.editor.sendChange(deckText('Shop', 'Next'));
    await settle();
    expect(h.file()).toContain('my paragraph');
    expect(h.file()).toContain('### Next %%a%%');
  });
});
