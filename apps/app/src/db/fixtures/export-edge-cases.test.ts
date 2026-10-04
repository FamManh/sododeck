import { checkDeck, fromJSON, toJSON } from '@sododeck/model';
import { parseSododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { edgeCaseDeck, nameClashDeck } from './export-edge-cases';

describe('edge-case fixtures', () => {
  it.each([
    ['edgeCaseDeck', edgeCaseDeck],
    ['nameClashDeck', nameClashDeck],
  ])('%s is a valid deck the model keeps as is', (_, make) => {
    const deck = make();
    const parsed = parseSododeckFile(deck);
    expect(parsed.success ? [] : parsed.issues).toEqual([]);
    expect(toJSON(fromJSON(deck))).toEqual(deck);
  });

  it('keeps the broken references the export must report', () => {
    const kinds = checkDeck(edgeCaseDeck()).list.map((p) => p.kind);
    expect(kinds).toContain('db-dangling-reference');
    expect(kinds).toContain('db-composite-mismatch');
  });
});
