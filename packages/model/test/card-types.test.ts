import { describe, expect, it } from 'vitest';

import {
  CARD_TYPES,
  CATEGORIES,
  cardType,
  deckPacks,
  isKnownType,
  LEGACY_PACKS,
  NEW_DECK_PACKS,
  PACKS,
  packTypeCount,
  typeName,
  typesOfPacks,
} from '../src';

const LEGACY_IDS = ['service', 'database', 'gateway', 'client', 'queue', 'external'];

describe('card type registry (030)', () => {
  it('lists the 13 built-in types in registry order with packs and categories', () => {
    expect(CARD_TYPES.map((t) => [t.id, t.pack, t.category])).toEqual([
      ['service', 'architecture', 'architecture'],
      ['database', 'architecture', 'architecture'],
      ['gateway', 'architecture', 'architecture'],
      ['client', 'architecture', 'architecture'],
      ['queue', 'architecture', 'architecture'],
      ['external', 'architecture', 'architecture'],
      ['component', 'architecture', 'architecture'],
      ['task', 'process', 'process'],
      ['decision', 'process', 'process'],
      ['document', 'process', 'process'],
      ['warehouse', 'logistics', 'logistics'],
      ['truck-route', 'logistics', 'logistics'],
      ['issue', 'data', 'data'],
    ]);
    expect(CARD_TYPES.map((t) => t.order)).toEqual(CARD_TYPES.map((_, i) => i));
    expect(CARD_TYPES.every((t) => t.family === 'card')).toBe(true);
  });

  it('has four packs and four categories, in order', () => {
    expect(PACKS.map((p) => p.id)).toEqual(['architecture', 'process', 'logistics', 'data']);
    expect(CATEGORIES.map((c) => c.id)).toEqual(['architecture', 'process', 'logistics', 'data']);
    expect(CATEGORIES.map((c) => c.name)).toEqual(['Architecture', 'Process', 'Logistics', 'Data']);
  });

  it('gives every id the schema pattern and keeps ids apart from names', () => {
    for (const t of CARD_TYPES) expect(t.id).toMatch(/^[a-z][a-z0-9-]{0,47}$/);
    for (const p of PACKS) expect(p.id).toMatch(/^[a-z][a-z0-9-]{0,47}$/);
    expect(new Set(CARD_TYPES.map((t) => t.id)).size).toBe(CARD_TYPES.length);
  });

  it('keeps the six legacy ids in the architecture pack with today’s names', () => {
    for (const id of LEGACY_IDS) expect(cardType(id)?.pack).toBe('architecture');
    expect(typeName('gateway')).toBe('Gateway');
    expect(typeName('truck-route')).toBe('Truck route');
  });

  it('typeName returns the id for an unknown type, and isKnownType says so', () => {
    expect(typeName('robot')).toBe('robot');
    expect(cardType('robot')).toBeUndefined();
    expect(isKnownType('robot')).toBe(false);
    expect(isKnownType('service')).toBe(true);
  });

  it('exposes the legacy and new-deck pack lists', () => {
    expect(LEGACY_PACKS).toEqual(['architecture']);
    expect(NEW_DECK_PACKS).toEqual(['architecture', 'process', 'logistics', 'data']);
  });

  describe('deckPacks', () => {
    it('is architecture only when the file has no packs', () => {
      expect(deckPacks({})).toEqual(['architecture']);
    });
    it('is the stored list in registry order, unknown ids after, sorted', () => {
      expect(deckPacks({ packs: ['data', 'zeta', 'architecture', 'alpha', 'process'] })).toEqual([
        'architecture',
        'process',
        'data',
        'alpha',
        'zeta',
      ]);
    });
  });

  describe('typesOfPacks and packTypeCount', () => {
    it('gives the Architecture pack (7 types) for the legacy list', () => {
      const types = typesOfPacks(LEGACY_PACKS);
      expect(types).toHaveLength(7);
      expect(types.every((t) => t.pack === 'architecture')).toBe(true);
    });
    it('keeps registry order whatever the order asked', () => {
      expect(typesOfPacks(['logistics', 'process']).map((t) => t.id)).toEqual([
        'task',
        'decision',
        'document',
        'warehouse',
        'truck-route',
      ]);
    });
    it('ignores unknown packs', () => {
      expect(typesOfPacks(['nope'])).toEqual([]);
    });
    it('counts types per pack', () => {
      expect(PACKS.map((p) => packTypeCount(p.id))).toEqual([7, 3, 2, 1]);
      expect(packTypeCount('nope')).toBe(0);
    });
  });
});
