import { describe, expect, it } from 'vitest';

import { sweepBlobs } from './blob-gc';
import { hasBlob, putBlob } from './blob-store';
import { freshLibraryDb } from '../test/library-fixtures';

const picture = { type: 'image/png', bytes: new Uint8Array([1]) };

describe('sweepBlobs', () => {
  it('deletes unreferenced rows only and is idempotent', async () => {
    const db = await freshLibraryDb();
    await putBlob(db, 'd1', 'keep', picture);
    await putBlob(db, 'd1', 'orphan', picture);
    expect(await sweepBlobs(db, 'd1', ['keep'])).toEqual(['orphan']);
    expect(await hasBlob(db, 'd1', 'keep')).toBe(true);
    expect(await hasBlob(db, 'd1', 'orphan')).toBe(false);
    expect(await sweepBlobs(db, 'd1', ['keep'])).toEqual([]);
  });

  it('never touches another deck', async () => {
    const db = await freshLibraryDb();
    await putBlob(db, 'd1', 'aa', picture);
    await putBlob(db, 'd2', 'aa', picture);
    await sweepBlobs(db, 'd1', []);
    expect(await hasBlob(db, 'd1', 'aa')).toBe(false);
    expect(await hasBlob(db, 'd2', 'aa')).toBe(true);
  });
});
