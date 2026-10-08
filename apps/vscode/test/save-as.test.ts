import { fromMarkdown, isDeckMarkdown } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { DeckDocument } from '../src/deck-document';
import { rewritePicturePaths, saveDocumentAs } from '../src/save-as';
import { deckWithPathPicture, emptyDeckText, PNG, PNG_ID } from './deck-fixtures';
import { makeFakes } from './fakes';
import { deckText, noteWithOwnText } from './note-fixtures';

const OLD = 'file:///ws/docs/old.sododeck';
const NEW = 'file:///ws/other/new.sododeck';
const SRC_PATH = 'old.assets/pic.png';
const stored = `new.assets/${PNG_ID.slice(0, 16)}.png`;

function setup(text = deckWithPathPicture(PNG_ID, SRC_PATH)) {
  const fakes = makeFakes();
  fakes.files.set(OLD, text);
  fakes.files.set(`file:///ws/docs/${SRC_PATH}`, PNG);
  const doc = DeckDocument.fromDisk(OLD, text);
  return { fakes, doc, text };
}

describe('saveDocumentAs', () => {
  it('copies pictures next to the new deck and rewrites only their paths', async () => {
    const { fakes, doc, text } = setup();
    await saveDocumentAs(doc, null, NEW, fakes);
    expect([...(fakes.files.data.get(`file:///ws/other/${stored}`) ?? [])]).toEqual([...PNG]);
    expect(fakes.files.get(NEW)).toBe(text.replace(SRC_PATH, stored));
  });

  it('leaves the old deck and its files untouched', async () => {
    const { fakes, doc, text } = setup();
    await saveDocumentAs(doc, null, NEW, fakes);
    expect(fakes.files.get(OLD)).toBe(text);
    expect([...(fakes.files.data.get(`file:///ws/docs/${SRC_PATH}`) ?? [])]).toEqual([...PNG]);
  });

  it('never overwrites a different file already there', async () => {
    const { fakes, doc } = setup();
    fakes.files.set(`file:///ws/other/${stored}`, new Uint8Array([7]));
    await saveDocumentAs(doc, null, NEW, fakes);
    expect(fakes.files.get(NEW)).toContain(stored.replace('.png', '-2.png'));
    expect([...(fakes.files.data.get(`file:///ws/other/${stored}`) ?? [])]).toEqual([7]);
  });

  it('keeps the path of a picture that is missing, outside the workspace, or changed', async () => {
    const missing = setup();
    await missing.fakes.files.remove(`file:///ws/docs/${SRC_PATH}`);
    await saveDocumentAs(missing.doc, null, NEW, missing.fakes);
    expect(missing.fakes.files.get(NEW)).toBe(missing.text);

    const out = setup(deckWithPathPicture(PNG_ID, '../../../etc/pic.png'));
    out.fakes.files.set('file:///etc/pic.png', PNG);
    await saveDocumentAs(out.doc, null, NEW, out.fakes);
    expect(out.fakes.files.get(NEW)).toBe(out.text);

    const changed = setup();
    changed.fakes.files.set(`file:///ws/docs/${SRC_PATH}`, new Uint8Array([1, 2, 3]));
    await saveDocumentAs(changed.doc, null, NEW, changed.fakes);
    expect(changed.fakes.files.get(NEW)).toBe(changed.text);
  });

  it('writes a deck without picture files exactly as it is', async () => {
    const text = emptyDeckText();
    const { fakes, doc } = setup(text);
    await saveDocumentAs(doc, null, NEW, fakes);
    expect(fakes.files.get(NEW)).toBe(text);
  });

  it('copies nothing in an untrusted workspace', async () => {
    const { fakes, doc, text } = setup();
    fakes.control.trusted = false;
    await saveDocumentAs(doc, null, NEW, fakes);
    expect(fakes.files.get(NEW)).toBe(text);
    expect(fakes.files.data.has(`file:///ws/other/${stored}`)).toBe(false);
  });

  it('flushes first, so the newest canvas text is what is written', async () => {
    const { fakes, doc } = setup(emptyDeckText());
    let flushed = false;
    const session = {
      flush: () => {
        doc.applyChange(0, 'LATEST');
        flushed = true;
        return Promise.resolve();
      },
      sendExternalChange: () => {},
    };
    await saveDocumentAs(doc, session, NEW, fakes);
    expect(flushed).toBe(true);
    expect(fakes.files.get(NEW)).toBe('LATEST');
  });
});

describe('rewritePicturePaths', () => {
  it('changes only the path and keeps the rest of the canonical text', () => {
    const text = deckWithPathPicture(PNG_ID, 'a/b.png');
    expect(rewritePicturePaths(text, new Map([[PNG_ID, 'c/d.png']]))).toBe(
      text.replace('a/b.png', 'c/d.png'),
    );
  });

  it('is the identity when nothing changes', () => {
    const text = deckWithPathPicture(PNG_ID, 'a/b.png');
    expect(rewritePicturePaths(text, new Map())).toBe(text);
  });
});

describe('saveDocumentAs between forms', () => {
  it('converts a plain deck to a note', async () => {
    const fakes = makeFakes();
    const text = deckText();
    const doc = DeckDocument.fromDisk(OLD, text);
    await saveDocumentAs(doc, null, 'file:///ws/other/new.sododeck.md', fakes);
    const written = fakes.files.get('file:///ws/other/new.sododeck.md') ?? '';
    expect(isDeckMarkdown(written)).toBe(true);
    expect(fromMarkdown(written)).toMatchObject({ ok: true, deckText: text });
  });

  it('converts a note to a plain deck', async () => {
    const fakes = makeFakes();
    const doc = DeckDocument.fromDisk('file:///ws/a.sododeck.md', noteWithOwnText());
    await saveDocumentAs(doc, null, NEW, fakes);
    expect(fakes.files.get(NEW)).toBe(deckText());
  });
});
