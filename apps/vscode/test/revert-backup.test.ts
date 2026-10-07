import { describe, expect, it } from 'vitest';

import { backupDocument, openDocument, revertDocument } from '../src/document-ops';
import { HostSession } from '../src/host-session';
import { emptyDeckText } from './deck-fixtures';
import { FakeEditor, settle } from './fake-editor';
import { makeFakes } from './fakes';

const DECK = 'file:///ws/docs/arch.sododeck';
const BACKUP = 'file:///backups/abc';

describe('revert', () => {
  it('reads the disk, sets text and saved text, sends external-change and clears dirty', async () => {
    const fakes = makeFakes();
    fakes.files.set(DECK, emptyDeckText());
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
    editor.sendChange('EDITED');
    await settle();
    fakes.files.set(DECK, 'DISK');
    await revertDocument(fakes.files, doc, session);
    await settle();
    expect(doc.text).toBe('DISK');
    expect(doc.savedText).toBe('DISK');
    expect(doc.dirty).toBe(false);
    expect(editor.of('external-change')).toEqual([{ type: 'external-change', text: 'DISK' }]);
    expect(fakes.files.writes).toEqual([]);
  });

  it('keeps the document when the file is gone', async () => {
    const fakes = makeFakes();
    fakes.files.set(DECK, 'A');
    const doc = await openDocument(fakes.files, DECK);
    doc.applyChange(0, 'B');
    await fakes.files.remove(DECK);
    await revertDocument(fakes.files, doc, null);
    expect(doc.text).toBe('B');
  });
});

describe('backup and restore', () => {
  it('backs up the current text and restores it dirty against the disk', async () => {
    const fakes = makeFakes();
    fakes.files.set(DECK, 'DISK');
    const doc = await openDocument(fakes.files, DECK);
    doc.applyChange(0, 'UNSAVED');
    await backupDocument(fakes.files, doc, BACKUP);
    expect(fakes.files.get(BACKUP)).toBe('UNSAVED');

    const restored = await openDocument(fakes.files, DECK, BACKUP);
    expect(restored.text).toBe('UNSAVED');
    expect(restored.savedText).toBe('DISK');
    expect(restored.dirty).toBe(true);
  });

  it('falls back to the disk text when the backup is missing', async () => {
    const fakes = makeFakes();
    fakes.files.set(DECK, 'DISK');
    const doc = await openDocument(fakes.files, DECK, 'file:///backups/gone');
    expect(doc.text).toBe('DISK');
    expect(doc.dirty).toBe(false);
  });

  it('opens a missing file as empty', async () => {
    const fakes = makeFakes();
    const doc = await openDocument(fakes.files, DECK);
    expect(doc.text).toBe('');
    expect(doc.dirty).toBe(false);
  });
});
