import { fromMarkdown, isDeckMarkdown, toMarkdown } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { openDocument, saveDocument } from '../src/document-ops';
import { makeFakes } from './fakes';
import { brokenNote, deckText, noteWithOwnText, unmarkedMarkdown } from './note-fixtures';

const NOTE = 'file:///ws/docs/arch.sododeck.md';

/** The text after the generated region's end line: what the user wrote around the deck. */
function afterRegion(note: string): string {
  const end = note.lastIndexOf('%% sododeck:end %%');
  return note.slice(note.indexOf('\n', end) + 1);
}

describe('note round trip (SC-002)', () => {
  it('open, edit, save, reopen: text outside the generated region is unchanged', async () => {
    const fakes = makeFakes();
    const original = `${noteWithOwnText()}\nTrailing words\n`;
    fakes.files.set(NOTE, original);
    const doc = await openDocument(fakes.files, NOTE);
    doc.applyChange(0, deckText('Billing'));
    await saveDocument(fakes.files, doc, null);
    const saved = fakes.files.get(NOTE) ?? '';
    expect(afterRegion(saved)).toBe(afterRegion(original));
    expect(afterRegion(saved)).toContain('Trailing words');
    const reopened = await openDocument(fakes.files, NOTE);
    expect(reopened.text).toBe(deckText('Billing'));
    expect(reopened.dirty).toBe(false);
    expect(fromMarkdown(saved)).toMatchObject({ ok: true, deckText: deckText('Billing') });
  });

  it('a second save with no change leaves the file as it is', async () => {
    const fakes = makeFakes();
    fakes.files.set(NOTE, toMarkdown(deckText()));
    const doc = await openDocument(fakes.files, NOTE);
    doc.applyChange(0, deckText('B'));
    await saveDocument(fakes.files, doc, null);
    const once = fakes.files.get(NOTE);
    await saveDocument(fakes.files, doc, null);
    expect(fakes.files.get(NOTE)).toBe(once);
  });

  it('files without the marker or with a broken block are never rewritten', async () => {
    for (const file of [unmarkedMarkdown, brokenNote]) {
      const fakes = makeFakes();
      fakes.files.set(NOTE, file);
      const doc = await openDocument(fakes.files, NOTE);
      await saveDocument(fakes.files, doc, null);
      expect(fakes.files.get(NOTE)).toBe(file);
      expect(isDeckMarkdown(file)).toBe(file === brokenNote);
    }
  });
});
