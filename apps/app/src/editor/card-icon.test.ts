import { describe, expect, it } from 'vitest';

import { cardIconRef, customIcon } from './card-icon';

describe('cardIconRef', () => {
  it('returns the stored reference of a card', () => {
    expect(cardIconRef({ type: 'service', icon: 'lucide:search' })).toBe('lucide:search');
  });

  it('returns nothing for a node without an icon or drawn as a shape', () => {
    expect(cardIconRef({ type: 'service' })).toBeUndefined();
    expect(cardIconRef({ type: 'rectangle', icon: 'lucide:search' })).toBeUndefined();
  });
});

describe('customIcon', () => {
  it('resolves a readable reference and ignores one the app cannot show', () => {
    expect(customIcon('lucide:search')?.name).toBe('search');
    expect(customIcon('simple:kafka')).toBeUndefined();
    expect(customIcon(undefined)).toBeUndefined();
  });
});
