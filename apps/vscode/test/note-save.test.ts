import { fromMarkdown, isDeckMarkdown, toMarkdown } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { openDocument, saveDocument } from '../src/document-ops';
import { makeFakes } from './fakes';
import { deckText, noteWithOwnText, OWN_TEXT } from './note-fixtures';

const NOTE = 'file:///ws/docs/arch.sododeck.md';

async function setup(file = noteWithOwnText()) {
  const fakes = makeFakes();
  fakes.files.set(NOTE, file);
  const doc = await openDocument(fakes.files, NOTE);
  return { fakes, doc };
}

describe('saving a note', () => {
  it('keeps the paragraph after the generated region byte for byte', async () => {
    const { fakes, doc } = await setup();
    doc.applyChange(0, deckText('Billing'));
    await saveDocument(fakes.files, doc, null);
    const written = fakes.files.get(NOTE) ?? '';
    expect(isDeckMarkdown(written)).toBe(true);
    expect(written.endsWith(OWN_TEXT)).toBe(true);
    expect(fromMarkdown(written)).toMatchObject({ ok: true, deckText: deckText('Billing') });
    expect(doc.dirty).toBe(false);
    expect(doc.fileText).toBe(written);
  });

  it('writes nothing for a clean note', async () => {
    const { fakes, doc } = await setup();
    await saveDocument(fakes.files, doc, null);
    expect(fakes.files.writes).toEqual([]);
  });

  it('reads a note written by toMarkdown (the other host) and writes it back', async () => {
    const other = toMarkdown(deckText());
    const { fakes, doc } = await setup(other);
    expect(doc.text).toBe(deckText());
    doc.applyChange(0, deckText('Payments'));
    await saveDocument(fakes.files, doc, null);
    expect(fromMarkdown(fakes.files.get(NOTE) ?? '')).toMatchObject({
      deckText: deckText('Payments'),
    });
  });
});
