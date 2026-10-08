import { describe, expect, it } from 'vitest';

import { backupDocument, openDocument, saveDocument } from '../src/document-ops';
import { makeFakes } from './fakes';
import { brokenNote, deckText, noteWithOwnText } from './note-fixtures';

const NOTE = 'file:///ws/docs/arch.sododeck.md';
const BACKUP = 'file:///backups/n1';

describe('opening a note', () => {
  it('decodes the note to deck text', async () => {
    const fakes = makeFakes();
    fakes.files.set(NOTE, noteWithOwnText());
    const doc = await openDocument(fakes.files, NOTE);
    expect(doc.text).toBe(deckText());
    expect(doc.dirty).toBe(false);
  });

  it('restores a hot-exit backup dirty against the disk, and backs up file text', async () => {
    const fakes = makeFakes();
    fakes.files.set(NOTE, noteWithOwnText());
    const doc = await openDocument(fakes.files, NOTE);
    doc.applyChange(0, deckText('Billing'));
    await backupDocument(fakes.files, doc, BACKUP);
    const backed = fakes.files.get(BACKUP) ?? '';
    expect(backed).toContain('Billing');
    expect(backed).toContain('My own paragraph.');
    const restored = await openDocument(fakes.files, NOTE, BACKUP);
    expect(restored.text).toBe(deckText('Billing'));
    expect(restored.dirty).toBe(true);
  });

  it('an undecodable note has problems, is not dirty and is never written', async () => {
    const fakes = makeFakes();
    fakes.files.set(NOTE, brokenNote);
    const doc = await openDocument(fakes.files, NOTE);
    expect(doc.problems?.length).toBeGreaterThan(0);
    expect(doc.dirty).toBe(false);
    await saveDocument(fakes.files, doc, null);
    expect(fakes.files.writes).toEqual([]);
    expect(fakes.files.get(NOTE)).toBe(brokenNote);
  });
});
