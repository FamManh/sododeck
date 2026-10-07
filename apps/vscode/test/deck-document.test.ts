import { describe, expect, it } from 'vitest';

import { DeckDocument } from '../src/deck-document';

describe('DeckDocument', () => {
  it('opens clean from disk', () => {
    const doc = DeckDocument.fromDisk('file:///a.sododeck', 'A');
    expect(doc.text).toBe('A');
    expect(doc.savedText).toBe('A');
    expect(doc.dirty).toBe(false);
  });

  it('opens dirty from a backup, with the disk text as the saved text', () => {
    const doc = DeckDocument.fromBackup('file:///a.sododeck', 'B', 'A');
    expect(doc.text).toBe('B');
    expect(doc.savedText).toBe('A');
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
    expect(doc.savedText).toBe('B');
    expect(doc.lastWritten).toBe('B');
    expect(doc.dirty).toBe(false);
  });

  it('applyDisk ignores text equal to text, savedText or lastWritten', () => {
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
    expect(doc.savedText).toBe('D');
    expect(doc.dirty).toBe(false);
  });
});
