import { inspectDeckText } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { newDeck, openInWeb, WEB_APP_URL } from '../src/commands';
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
