import { describe, expect, it } from 'vitest';

import { EXPORT_NOTE_KINDS, mergeNotes, note } from './notes';

describe('notes', () => {
  it('lists the 20 kinds of data-model §3', () => {
    expect(EXPORT_NOTE_KINDS).toHaveLength(20);
    expect(new Set(EXPORT_NOTE_KINDS).size).toBe(20);
  });

  it('merges identical notes and sorts by table order, then kind, then creation', () => {
    const notes = [
      note('empty-type', 'b.x has no type; written as text', { tableId: 'b', columnId: 'x' }),
      note('stale-reference', 'later in b', { tableId: 'b' }),
      note('fk-out-of-scope', 'a out', { tableId: 'a' }),
      note('enum-not-created', 'no table'),
      note('empty-type', 'b.x has no type; written as text', { tableId: 'b', columnId: 'x' }),
      note('empty-type', 'a.y has no type; written as text', { tableId: 'a' }),
    ];
    expect(mergeNotes(notes, ['a', 'b']).map((n) => n.message)).toEqual([
      'a out',
      'a.y has no type; written as text',
      'later in b',
      'b.x has no type; written as text',
      'no table',
    ]);
  });
});
