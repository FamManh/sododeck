import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { LibraryDb } from './library-db';

describe('LibraryDb', () => {
  it('stores and lists deck metadata by recency', async () => {
    const db = new LibraryDb('test-library');
    await db.decks.bulkPut([
      { id: 'a', name: 'Delivery', createdAt: 1, updatedAt: 10 },
      { id: 'b', name: 'Returns', createdAt: 2, updatedAt: 20 },
    ]);
    const names = (await db.decks.orderBy('updatedAt').reverse().toArray()).map((d) => d.name);
    expect(names).toEqual(['Returns', 'Delivery']);
    db.close();
  });
});
