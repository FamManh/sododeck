import { describe, expect, it } from 'vitest';

import { DEBOUNCE_MS, DiskSync, REPLACED_NOTICE } from '../src/disk-sync';
import { openDocument, saveDocument } from '../src/document-ops';
import { HostSession } from '../src/host-session';
import { emptyDeckText } from './deck-fixtures';
import { FakeEditor, settle } from './fake-editor';
import { makeFakes } from './fakes';

const DECK = 'file:///ws/docs/arch.sododeck';

async function setup(disk = emptyDeckText()) {
  const fakes = makeFakes();
  fakes.files.set(DECK, disk);
  const editor = new FakeEditor();
  const doc = await openDocument(fakes.files, DECK);
  const marks = { changed: 0, cleared: 0 };
  const session = new HostSession({
    doc,
    transport: editor.host,
    ports: fakes,
    onContentChange: () => {
      marks.changed++;
    },
  });
  const sync = new DiskSync({
    doc,
    ports: fakes,
    session: () => session,
    onContentChange: () => {
      marks.changed++;
    },
    clearMark: () => {
      marks.cleared++;
      return Promise.resolve();
    },
  });
  sync.watch();
  editor.ready();
  await settle();
  editor.clear();
  const touch = async (text?: string): Promise<void> => {
    if (text !== undefined) fakes.files.set(DECK, text);
    fakes.control.fireFile(DECK);
    fakes.clock.advance(DEBOUNCE_MS);
    await settle();
  };
  return { fakes, editor, doc, session, sync, marks, touch };
}

describe('disk sync', () => {
  it('ignores the echo of our own save', async () => {
    const { fakes, editor, doc, session, touch } = await setup();
    editor.sendChange('MINE');
    await settle();
    await saveDocument(fakes.files, doc, session);
    editor.clear();
    await touch();
    expect(editor.of('external-change')).toEqual([]);
    expect(fakes.ui.notices).toEqual([]);
  });

  it('ignores a file that still equals the canvas text or the saved text', async () => {
    const disk = emptyDeckText();
    const { editor, touch } = await setup(disk);
    await touch(disk);
    editor.sendChange('EDIT');
    await settle();
    await touch('EDIT');
    expect(editor.of('external-change')).toEqual([]);
  });

  it('sends a different text as external-change and adopts it', async () => {
    const { editor, doc, touch, marks } = await setup();
    await touch('FROM GIT');
    expect(editor.of('external-change')).toEqual([{ type: 'external-change', text: 'FROM GIT' }]);
    expect(doc.text).toBe('FROM GIT');
    expect(doc.dirty).toBe(false);
    expect(marks.cleared).toBe(0);
  });

  it('replaces unsaved edits: clears the mark, one notice, no prompt (FR-013)', async () => {
    const { fakes, editor, doc, touch, marks } = await setup();
    editor.sendChange('UNSAVED');
    await settle();
    await touch('FROM GIT');
    expect(doc.text).toBe('FROM GIT');
    expect(doc.dirty).toBe(false);
    expect(marks.cleared).toBe(1);
    expect(fakes.ui.notices).toEqual([REPLACED_NOTICE]);
    expect(fakes.files.writes).toEqual([]);
  });

  it('shows an invalid disk text through the canvas and never writes or reverts', async () => {
    const { fakes, editor, doc, session, touch } = await setup();
    await touch('{broken');
    expect(editor.of('external-change')).toEqual([{ type: 'external-change', text: '{broken' }]);
    await saveDocument(fakes.files, doc, session);
    expect(fakes.files.writes).toEqual([]);
    expect(fakes.files.get(DECK)).toBe('{broken');
  });

  it('keeps the document when the file is deleted and offers save', async () => {
    const { fakes, doc, touch, marks } = await setup();
    await fakes.files.remove(DECK);
    await touch();
    expect(doc.missing).toBe(true);
    expect(doc.dirty).toBe(true);
    expect(marks.changed).toBe(1);
    await touch();
    expect(marks.changed).toBe(1);
    await touch('BACK');
    expect(doc.missing).toBe(false);
    expect(doc.text).toBe('BACK');
  });

  it('reads once for a burst of events, and once more for events during the read', async () => {
    const { fakes, editor, touch } = await setup();
    let reads = 0;
    const original = fakes.files.read.bind(fakes.files);
    fakes.files.read = async (loc) => {
      reads++;
      return original(loc);
    };
    fakes.files.set(DECK, 'X');
    for (let i = 0; i < 20; i++) fakes.control.fireFile(DECK);
    fakes.clock.advance(DEBOUNCE_MS);
    await settle();
    expect(reads).toBe(1);
    expect(editor.of('external-change')).toHaveLength(1);
    await touch('Y');
    expect(reads).toBe(2);
  });

  it('keeps at most one comparison in flight', async () => {
    const { fakes, sync } = await setup();
    let inFlight = 0;
    let peak = 0;
    const original = fakes.files.read.bind(fakes.files);
    fakes.files.read = async (loc) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight--;
      return original(loc);
    };
    await Promise.all([sync.check(), sync.check(), sync.check()]);
    expect(peak).toBe(1);
  });

  it('catches a missed watcher event on recheck (focus, visibility)', async () => {
    const { fakes, editor, sync } = await setup();
    fakes.files.set(DECK, 'MISSED');
    await sync.recheck();
    await settle();
    expect(editor.of('external-change')).toHaveLength(1);
  });

  it('updates the document while the tab is hidden; a reloaded webview gets the new text', async () => {
    const { fakes, editor, doc, session } = await setup();
    session.dispose();
    const sync = new DiskSync({
      doc,
      ports: fakes,
      session: () => null,
      onContentChange: () => {},
      clearMark: () => Promise.resolve(),
    });
    fakes.files.set(DECK, 'WHILE HIDDEN');
    await sync.check();
    expect(doc.text).toBe('WHILE HIDDEN');
    const again = new HostSession({
      doc,
      transport: editor.host,
      ports: fakes,
      onContentChange: () => {},
    });
    editor.clear();
    editor.ready();
    await settle();
    expect(editor.of('init')[0]?.text).toBe('WHILE HIDDEN');
    again.dispose();
  });

  it('stops after dispose', async () => {
    const { fakes, editor, sync } = await setup();
    sync.dispose();
    fakes.files.set(DECK, 'LATE');
    fakes.control.fireFile(DECK);
    fakes.clock.advance(DEBOUNCE_MS);
    await settle();
    expect(editor.of('external-change')).toEqual([]);
  });
});
