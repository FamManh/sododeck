import { createDeck } from '@sododeck/model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { insertDeck, loadDeckLog, type LibraryDb } from '../storage/library-db';
import { setLibraryDbForTests } from '../storage/library-db-instance';
import { legacyDeckBytes } from '../test/legacy-deck';
import { deckRecord, freshLibraryDb } from '../test/library-fixtures';
import { deckLoader } from './deck-loader';

let db: LibraryDb;

const load = (deckId: string) => {
  const url = `http://localhost/deck/${deckId}`;
  const args = { params: { deckId }, request: new Request(url) };
  return deckLoader(args as unknown as Parameters<typeof deckLoader>[0]);
};

beforeEach(async () => {
  db = await freshLibraryDb();
  setLibraryDbForTests(db);
});

afterEach(() => {
  setLibraryDbForTests(undefined);
});

describe('deckLoader', () => {
  it('loads a deck stored in the current layout', async () => {
    await insertDeck(db, deckRecord('d1'), Y.encodeStateAsUpdate(createDeck()));
    expect(await load('d1')).toMatchObject({ kind: 'stored', deckId: 'd1' });
  });

  it('hands a deck stored before 036 to the editor page undecoded, and changes nothing', async () => {
    // The loader re-runs on every canvas ↔ rule editor move, so it never decodes the bytes; the
    // editor page refuses the deck (editor-page.test.tsx, FR-027).
    const bytes = legacyDeckBytes();
    await insertDeck(db, deckRecord('old'), bytes);
    expect(await load('old')).toMatchObject({ kind: 'stored', deckId: 'old' });
    const stored = (await loadDeckLog(db, 'old'))?.bytes ?? [];
    expect(stored.map((b) => Array.from(b))).toEqual([Array.from(bytes)]);
  });
});
