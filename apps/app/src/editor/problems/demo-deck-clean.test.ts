import { checkDeck } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { demoDeck } from '../demo-deck';

describe('demo deck (015 SC-001)', () => {
  it('has no problems', () => {
    expect(checkDeck(demoDeck).list).toEqual([]);
  });
});
