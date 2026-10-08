import { describe, expect, it } from 'vitest';

import { DEBOUNCE_MS, DiskSync, REPLACED_NOTICE } from '../src/disk-sync';
import { openDocument, saveDocument } from '../src/document-ops';
import { HostSession } from '../src/host-session';
import { FakeEditor, settle } from './fake-editor';
import { makeFakes } from './fakes';
import { deckText, noteWithEditedTitle, noteWithOwnText, OWN_TEXT } from './note-fixtures';

const NOTE = 'file:///ws/docs/arch.sododeck.md';

async function setup() {
  const fakes = makeFakes();
  fakes.files.set(NOTE, noteWithOwnText());
  const editor = new FakeEditor();
  const doc = await openDocument(fakes.files, NOTE);
  const session = new HostSession({
    doc,
    transport: editor.host,
    ports: fakes,
    onContentChange: () => {},
  });
  const sync = new DiskSync({
    doc,
    ports: fakes,
    session: () => session,
    onContentChange: () => {},
    clearMark: () => Promise.resolve(),
  });
  sync.watch();
  editor.ready();
  await settle();
  editor.clear();
  const touch = async (file?: string): Promise<void> => {
    if (file !== undefined) fakes.files.set(NOTE, file);
    fakes.control.fireFile(NOTE);
    fakes.clock.advance(DEBOUNCE_MS);
    await settle();
  };
  return { fakes, editor, doc, session, touch };
}

describe('note disk sync', () => {
  it('a title edited as text reaches the canvas as deck text', async () => {
    const { editor, touch } = await setup();
    await touch(noteWithEditedTitle('Orders', 'Payments'));
    const sent = editor.of('external-change');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain('Payments');
    expect(sent[0]?.text).not.toContain('# ');
  });

  it('a paragraph added on disk sends nothing, and a later save keeps it', async () => {
    const { fakes, editor, doc, session, touch } = await setup();
    await touch(`${noteWithOwnText()}Added later.\n`);
    expect(editor.of('external-change')).toEqual([]);
    editor.sendChange(deckText('Billing'));
    await settle();
    await saveDocument(fakes.files, doc, session);
    const written = fakes.files.get(NOTE) ?? '';
    expect(written).toContain('Added later.');
    expect(written).toContain(OWN_TEXT.trim());
    expect(written).toContain('Billing');
  });

  it('does not echo our own write', async () => {
    const { fakes, editor, doc, session, touch } = await setup();
    editor.sendChange(deckText('Billing'));
    await settle();
    await saveDocument(fakes.files, doc, session);
    editor.clear();
    await touch();
    expect(editor.of('external-change')).toEqual([]);
  });

  it('tells the user when unsaved edits are replaced', async () => {
    const { fakes, editor, touch } = await setup();
    editor.sendChange(deckText('Unsaved'));
    await settle();
    await touch(noteWithEditedTitle('Orders', 'Payments'));
    expect(fakes.ui.notices).toContain(REPLACED_NOTICE);
  });
});
