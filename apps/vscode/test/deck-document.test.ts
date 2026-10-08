import { describe, expect, it } from 'vitest';

import { DeckDocument } from '../src/deck-document';
import { brokenNote, deckText, noteWithEditedTitle, noteWithOwnText } from './note-fixtures';

describe('DeckDocument', () => {
  it('opens clean from disk', () => {
    const doc = DeckDocument.fromDisk('file:///a.sododeck', 'A');
    expect(doc.text).toBe('A');
    expect(doc.savedDeckText).toBe('A');
    expect(doc.dirty).toBe(false);
  });

  it('opens dirty from a backup, with the disk text as the saved text', () => {
    const doc = DeckDocument.fromBackup('file:///a.sododeck', 'B', 'A');
    expect(doc.text).toBe('B');
    expect(doc.savedDeckText).toBe('A');
    expect(doc.dirty).toBe(true);
  });

  it('keeps change text byte for byte and derives dirty', () => {
    const doc = DeckDocument.fromDisk('file:///a.sododeck', 'A');
    const odd = '{ "x" :1 }\r\n  ';
    expect(doc.applyChange(0, odd)).toEqual({ accepted: true, dirty: true });
    expect(doc.text).toBe(odd);
    expect(doc.applyChange(1, 'A')).toEqual({ accepted: true, dirty: false });
  });

  it('ignores a stale or repeated seq', () => {
    const doc = DeckDocument.fromDisk('file:///a.sododeck', 'A');
    doc.applyChange(5, 'X');
    expect(doc.applyChange(5, 'Y').accepted).toBe(false);
    expect(doc.applyChange(3, 'Z').accepted).toBe(false);
    expect(doc.text).toBe('X');
  });

  it('markSaved records the echo text and clears dirty', () => {
    const doc = DeckDocument.fromDisk('file:///a.sododeck', 'A');
    doc.applyChange(0, 'B');
    doc.markSaved();
    expect(doc.savedDeckText).toBe('B');
    expect(doc.lastWritten).toBe('B');
    expect(doc.dirty).toBe(false);
  });

  it('applyDisk ignores text equal to text, savedDeckText or lastWritten', () => {
    const doc = DeckDocument.fromDisk('file:///a.sododeck', 'A');
    doc.applyChange(0, 'B');
    expect(doc.applyDisk('B')).toBe(false);
    expect(doc.applyDisk('A')).toBe(false);
    doc.markSaved();
    doc.applyChange(1, 'C');
    expect(doc.applyDisk('B')).toBe(false);
    expect(doc.text).toBe('C');
  });

  it('applyDisk with new text replaces the document and clears dirty', () => {
    const doc = DeckDocument.fromDisk('file:///a.sododeck', 'A');
    doc.applyChange(0, 'B');
    expect(doc.applyDisk('D')).toBe(true);
    expect(doc.text).toBe('D');
    expect(doc.savedDeckText).toBe('D');
    expect(doc.dirty).toBe(false);
  });
});

describe('DeckDocument (note)', () => {
  const NOTE = 'file:///ws/a.sododeck.md';

  it('opens clean: text is the deck text, fileText the Markdown', () => {
    const file = noteWithOwnText();
    const doc = DeckDocument.fromDisk(NOTE, file);
    expect(doc.kind).toBe('markdown');
    expect(doc.fileText).toBe(file);
    expect(doc.text).toBe(deckText());
    expect(doc.savedDeckText).toBe(deckText());
    expect(doc.dirty).toBe(false);
  });

  it('compares deck text for dirty', () => {
    const doc = DeckDocument.fromDisk(NOTE, noteWithOwnText());
    doc.applyChange(0, deckText('Billing'));
    expect(doc.dirty).toBe(true);
    doc.applyChange(1, deckText());
    expect(doc.dirty).toBe(false);
  });

  it('an outside change to the user text refreshes fileText and reports nothing new', () => {
    const doc = DeckDocument.fromDisk(NOTE, noteWithOwnText());
    const edited = `${noteWithOwnText()}More.\n`;
    expect(doc.applyDisk(edited)).toBe(false);
    expect(doc.fileText).toBe(edited);
    expect(doc.text).toBe(deckText());
  });

  it('an outside change to the readable part replaces the document', () => {
    const doc = DeckDocument.fromDisk(NOTE, noteWithOwnText());
    doc.applyChange(0, deckText('Unsaved'));
    expect(doc.applyDisk(noteWithEditedTitle('Orders', 'Payments'))).toBe(true);
    expect(doc.text).toContain('Payments');
    expect(doc.dirty).toBe(false);
  });

  it('an unreadable note is never dirty and shows its file text to the canvas', () => {
    const doc = DeckDocument.fromDisk(NOTE, brokenNote);
    expect(doc.problems).not.toBeNull();
    expect(doc.dirty).toBe(false);
    expect(doc.canvasText).toBe(brokenNote);
    doc.missing = true;
    expect(doc.dirty).toBe(false);
  });

  it('recovers when the note becomes readable', () => {
    const doc = DeckDocument.fromDisk(NOTE, brokenNote);
    expect(doc.applyDisk(noteWithOwnText())).toBe(true);
    expect(doc.problems).toBeNull();
    expect(doc.text).toBe(deckText());
  });

  it('markSaved stores the file text and its echo is ignored', () => {
    const doc = DeckDocument.fromDisk(NOTE, noteWithOwnText());
    doc.applyChange(0, deckText('Billing'));
    const written = noteWithOwnText('Billing');
    doc.markSaved(doc.text, written);
    expect(doc.fileText).toBe(written);
    expect(doc.lastWritten).toBe(written);
    expect(doc.savedDeckText).toBe(deckText('Billing'));
    expect(doc.applyDisk(written)).toBe(false);
  });

  it('a backup restores dirty against the disk', () => {
    const doc = DeckDocument.fromBackup(NOTE, noteWithOwnText('Billing'), noteWithOwnText());
    expect(doc.text).toBe(deckText('Billing'));
    expect(doc.savedDeckText).toBe(deckText());
    expect(doc.fileText).toBe(noteWithOwnText());
    expect(doc.dirty).toBe(true);
  });
});
