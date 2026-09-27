import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { generateBenchDeck } from '../bench/generate-deck';
import { deckRecord, freshLibraryDb } from '../test/library-fixtures';
import { attachDeckPersistence, storageOrigin } from './deck-persistence';
import { insertDeck } from './library-db';

describe('deck persistence performance', () => {
  it('flushes an edit of the 500-node bench deck in under 50 ms', async () => {
    const db = await freshLibraryDb();
    const file = generateBenchDeck(500, 1000).deck;
    await insertDeck(db, deckRecord('bench'), Y.encodeStateAsUpdate(fromJSON(file)));
    const doc = new Y.Doc();
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(fromJSON(file)), storageOrigin);
    const editor = createEditor(doc);
    const persistence = attachDeckPersistence(db, 'bench', doc, {
      flushMs: 10_000,
      snapshot: () => toJSON(doc),
    });
    await persistence.whenLoaded;

    // Warm-up write (JIT, first transaction), then a drag-like batch of 6 frames.
    editor.update('nodes', 'n0', { position: { x: 1, y: 1 } });
    await persistence.flush();
    for (let i = 0; i < 6; i++) editor.update('nodes', 'n1', { position: { x: i, y: i } });

    const start = performance.now();
    await persistence.flush();
    const elapsed = performance.now() - start;
    persistence.destroy();
    expect(elapsed).toBeLessThan(50);
  });
});
