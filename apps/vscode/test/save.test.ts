import { describe, expect, it } from 'vitest';

import { DeckDocument } from '../src/deck-document';
import { openDocument, saveDocument } from '../src/document-ops';
import { HostSession } from '../src/host-session';
import { deckWithPathPicture, emptyDeckText, PNG_ID } from './deck-fixtures';
import { FakeEditor, settle } from './fake-editor';
import { makeFakes } from './fakes';

const DECK = 'file:///ws/docs/arch.sododeck';

async function setup(disk = emptyDeckText()) {
  const fakes = makeFakes();
  fakes.files.set(DECK, disk);
  const editor = new FakeEditor();
  const doc = await openDocument(fakes.files, DECK);
  const session = new HostSession({
    doc,
    transport: editor.host,
    ports: fakes,
    onContentChange: () => {},
  });
  editor.ready();
  await settle();
  return { fakes, editor, doc, session };
}

describe('save', () => {
  it('flushes, then writes exactly the canvas text', async () => {
    const { fakes, editor, doc, session } = await setup();
    const odd = `${emptyDeckText().trimEnd()}\n\n`;
    editor.sendChange(odd);
    await settle();
    await saveDocument(fakes.files, doc, session);
    expect(editor.of('flush')).toHaveLength(1);
    expect(fakes.files.get(DECK)).toBe(odd);
    expect(doc.dirty).toBe(false);
    expect(doc.savedDeckText).toBe(odd);
    expect(doc.lastWritten).toBe(odd);
  });

  it('includes an edit sent just before the flush answer', async () => {
    const { fakes, editor, doc, session } = await setup();
    editor.autoFlush = false;
    editor.sendChange('FIRST');
    await settle();
    const saving = saveDocument(fakes.files, doc, session);
    await settle();
    editor.sendChange('LAST EDIT');
    editor.answerFlush();
    await saving;
    expect(fakes.files.get(DECK)).toBe('LAST EDIT');
  });

  it('writes the last known text with a warning when the flush times out', async () => {
    const { fakes, editor, doc, session } = await setup();
    editor.autoFlush = false;
    editor.sendChange('KNOWN');
    await settle();
    const saving = saveDocument(fakes.files, doc, session);
    await settle();
    fakes.clock.advance(2000);
    await saving;
    expect(fakes.files.get(DECK)).toBe('KNOWN');
    expect(fakes.ui.warnings).toHaveLength(1);
  });

  it('writes nothing for a clean document and never reformats', async () => {
    const { fakes, doc, session } = await setup('{ "weird" :  1 }');
    await saveDocument(fakes.files, doc, session);
    expect(fakes.files.writes).toEqual([]);
    expect(fakes.files.get(DECK)).toBe('{ "weird" :  1 }');
  });

  it('saves a document with no canvas open (hot-exit backup restored, tab not shown)', async () => {
    const fakes = makeFakes();
    fakes.files.set(DECK, 'disk');
    const doc = DeckDocument.fromBackup(DECK, 'backup', 'disk');
    await saveDocument(fakes.files, doc, null);
    expect(fakes.files.get(DECK)).toBe('backup');
  });

  it('recreates a deleted file and clears the missing mark', async () => {
    const { fakes, doc, session } = await setup('x');
    doc.missing = true;
    expect(doc.dirty).toBe(true);
    await saveDocument(fakes.files, doc, session);
    expect(fakes.files.get(DECK)).toBe('x');
    expect(doc.dirty).toBe(false);
  });

  it('reports a failed write and stays dirty', async () => {
    const { fakes, editor, doc, session } = await setup();
    editor.sendChange('NEW');
    await settle();
    fakes.files.failRenames = true;
    await expect(saveDocument(fakes.files, doc, session)).rejects.toThrow(/Could not save/);
    expect(doc.dirty).toBe(true);
    expect(fakes.files.get(DECK)).toBe(emptyDeckText());
  });

  it('writes the deck file only through save: opening, editing and flushing do not', async () => {
    const { fakes, editor } = await setup(deckWithPathPicture(PNG_ID, 'arch.assets/p.png'));
    editor.sendChange('EDIT');
    editor.getPicture(PNG_ID);
    await settle();
    expect(fakes.files.writes).toEqual([]);
  });
});
