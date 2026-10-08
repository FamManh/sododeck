import {
  emptyDeckText as modelEmptyDeckText,
  fromMarkdown,
  inspectDeckText,
  toMarkdown,
} from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { copyAsSododeck, newDeck, newNote, openInWeb, WEB_APP_URL } from '../src/commands';
import { emptyDeckText } from '../src/host-session';
import { makeFakes } from './fakes';

describe('newDeck', () => {
  it('defaults the dialog to the first workspace folder, or the explorer folder', async () => {
    const fakes = makeFakes({ folders: ['file:///ws', 'file:///ws2'] });
    await newDeck(fakes);
    await newDeck(fakes, 'file:///ws/docs');
    expect(fakes.ui.saveDialogs.map((d) => d.folder)).toEqual(['file:///ws', 'file:///ws/docs']);
  });

  it('asks for a place when no folder is open', async () => {
    const fakes = makeFakes({ folders: [] });
    await newDeck(fakes);
    expect(fakes.ui.saveDialogs).toEqual([{ name: 'untitled.sododeck', folder: undefined }]);
  });

  it('writes the model empty deck, valid, and opens it', async () => {
    const fakes = makeFakes();
    fakes.ui.saveChoice = 'file:///ws/new.sododeck';
    await newDeck(fakes);
    const text = fakes.files.get('file:///ws/new.sododeck');
    expect(text).toBe(emptyDeckText());
    expect(inspectDeckText(text ?? '').ok).toBe(true);
    expect(fakes.ui.opened).toEqual(['file:///ws/new.sododeck']);
  });

  it('adds the extension when the name has none', async () => {
    const fakes = makeFakes();
    fakes.ui.saveChoice = 'file:///ws/plain';
    await newDeck(fakes);
    expect(fakes.files.get('file:///ws/plain.sododeck')).toBeDefined();
  });

  it('never overwrites an existing file', async () => {
    const fakes = makeFakes();
    fakes.files.set('file:///ws/a.sododeck', 'MINE');
    fakes.ui.saveChoice = 'file:///ws/a.sododeck';
    await newDeck(fakes);
    expect(fakes.files.get('file:///ws/a.sododeck')).toBe('MINE');
    expect(fakes.files.writes).toEqual([]);
    expect(fakes.ui.warnings).toHaveLength(1);
    expect(fakes.ui.opened).toEqual([]);
  });

  it('does nothing when the dialog is cancelled', async () => {
    const fakes = makeFakes();
    await newDeck(fakes);
    expect(fakes.files.writes).toEqual([]);
    expect(fakes.ui.opened).toEqual([]);
  });
});

describe('openInWeb', () => {
  it('reveals the file and opens the web app, nothing else', async () => {
    const fakes = makeFakes();
    await openInWeb(fakes, 'file:///ws/a.sododeck');
    expect(fakes.ui.revealed).toEqual(['file:///ws/a.sododeck']);
    expect(fakes.ui.external).toEqual([WEB_APP_URL]);
    expect(fakes.files.writes).toEqual([]);
  });

  it('says so when there is no active deck', async () => {
    const fakes = makeFakes();
    await openInWeb(fakes, undefined);
    expect(fakes.ui.external).toEqual([]);
    expect(fakes.ui.notices).toHaveLength(1);
  });
});

describe('newNote', () => {
  it('writes an empty deck note that reads back as the empty deck, and opens it', async () => {
    const fakes = makeFakes();
    fakes.ui.saveChoice = 'file:///ws/new.sododeck.md';
    await newNote(fakes);
    const text = fakes.files.get('file:///ws/new.sododeck.md') ?? '';
    expect(text).toBe(toMarkdown(modelEmptyDeckText()));
    expect(fromMarkdown(text)).toMatchObject({ ok: true, deckText: modelEmptyDeckText() });
    expect(fakes.ui.opened).toEqual(['file:///ws/new.sododeck.md']);
    expect(fakes.ui.saveDialogs[0]?.name).toBe('untitled.sododeck.md');
  });

  it('adds the extension when the name has none', async () => {
    const fakes = makeFakes();
    fakes.ui.saveChoice = 'file:///ws/plain';
    await newNote(fakes);
    expect(fakes.files.get('file:///ws/plain.sododeck.md')).toBeDefined();
  });

  it('never overwrites an existing file', async () => {
    const fakes = makeFakes();
    fakes.files.set('file:///ws/a.sododeck.md', 'MINE');
    fakes.ui.saveChoice = 'file:///ws/a.sododeck.md';
    await newNote(fakes);
    expect(fakes.files.get('file:///ws/a.sododeck.md')).toBe('MINE');
    expect(fakes.ui.warnings).toHaveLength(1);
  });
});

describe('copyAsSododeck', () => {
  const SRC = 'file:///ws/docs/old.sododeck.json';

  it('writes <name>.sododeck with identical text and leaves the original', async () => {
    const fakes = makeFakes();
    const text = `${emptyDeckText().trimEnd()}\n\n`;
    fakes.files.set(SRC, text);
    await copyAsSododeck(fakes, SRC);
    expect(fakes.files.get('file:///ws/docs/old.sododeck')).toBe(text);
    expect(fakes.files.get(SRC)).toBe(text);
    expect(fakes.ui.opened).toEqual(['file:///ws/docs/old.sododeck']);
  });

  it('never overwrites: a taken name gets a number', async () => {
    const fakes = makeFakes();
    fakes.files.set(SRC, emptyDeckText());
    fakes.files.set('file:///ws/docs/old.sododeck', 'MINE');
    await copyAsSododeck(fakes, SRC);
    expect(fakes.files.get('file:///ws/docs/old.sododeck')).toBe('MINE');
    expect(fakes.files.get('file:///ws/docs/old 1.sododeck')).toBe(emptyDeckText());
    expect(fakes.ui.opened).toEqual(['file:///ws/docs/old 1.sododeck']);
  });

  it('refuses text that is not a deck', async () => {
    const fakes = makeFakes();
    fakes.files.set(SRC, 'hello');
    await copyAsSododeck(fakes, SRC);
    expect(fakes.files.writes).toEqual([]);
    expect(fakes.ui.warnings).toEqual(['old.sododeck.json is not a Sododeck deck.']);
  });

  it('says why a write failed', async () => {
    const fakes = makeFakes();
    fakes.files.set(SRC, emptyDeckText());
    fakes.files.failRenames = true;
    await copyAsSododeck(fakes, SRC);
    expect(fakes.ui.warnings[0]).toContain('EXDEV');
    expect(fakes.ui.opened).toEqual([]);
  });
});
