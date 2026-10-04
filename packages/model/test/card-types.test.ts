import { describe, expect, it } from 'vitest';

import {
  CARD_TYPES,
  CATEGORIES,
  cardType,
  deckPacks,
  effectiveFamily,
  hasTwoForms,
  isDbTable,
  isKnownType,
  LEGACY_PACKS,
  NEW_DECK_PACKS,
  PACK_DISPLAY_ORDER,
  PACKS,
  packTypeCount,
  SHAPE_TYPE_IDS,
  shapeGeometryOf,
  typeName,
  typesOfPacks,
} from '../src';

const LEGACY_IDS = ['service', 'database', 'gateway', 'client', 'queue', 'external'];

describe('card type registry (030)', () => {
  it('lists the 14 card types in registry order with packs and categories', () => {
    const cards = CARD_TYPES.filter((t) => t.family === 'card');
    expect(cards.map((t) => [t.id, t.pack, t.category])).toEqual([
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
      ['db-table', 'database', 'database'],
    ]);
    expect(CARD_TYPES.map((t) => t.order)).toEqual(CARD_TYPES.map((_, i) => i));
    expect(cards).toHaveLength(14);
  });

  it('has six packs in file order and six categories in display order', () => {
    expect(PACKS.map((p) => p.id)).toEqual([
      'architecture',
      'process',
      'logistics',
      'data',
      'database',
      'shapes',
    ]);
    expect(CATEGORIES.map((c) => c.id)).toEqual([
      'shapes',
      'process',
      'data',
      'database',
      'architecture',
      'logistics',
    ]);
    expect(CATEGORIES.map((c) => c.name)).toEqual([
      'Shapes',
      'Process',
      'Data',
      'Database',
      'Architecture',
      'Logistics',
    ]);
  });

  it('shows packs in display order, apart from the file order (051 US7)', () => {
    expect([...PACK_DISPLAY_ORDER].sort()).toEqual(PACKS.map((p) => p.id).sort());
    expect(new Set(PACK_DISPLAY_ORDER).size).toBe(PACKS.length);
    expect([...PACKS].sort((a, b) => a.order - b.order).map((p) => p.name)).toEqual([
      'Basic shapes',
      'Process',
      'Data cards',
      'Database',
      'Architecture',
      'Logistics',
    ]);
    expect(PACKS.filter((p) => !p.onByDefault).map((p) => p.id)).toEqual(['logistics']);
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
    // File order (`sortPacks`), Logistics off (051 US7).
    expect(NEW_DECK_PACKS).toEqual(['architecture', 'process', 'data', 'database', 'shapes']);
  });

  it('has the Database pack with its Table type (040)', () => {
    expect(PACKS.find((p) => p.id === 'database')?.name).toBe('Database');
    expect(cardType('db-table')).toMatchObject({
      name: 'Table',
      pack: 'database',
      category: 'database',
      family: 'card',
    });
    expect(typesOfPacks(['database']).map((t) => t.id)).toEqual(['db-table']);
    expect(deckPacks({ packs: ['architecture', 'data'] })).toEqual(['architecture', 'data']);
  });

  it('isDbTable is true only for db-table (040)', () => {
    expect(isDbTable({ type: 'db-table' })).toBe(true);
    expect(isDbTable({ type: 'database' })).toBe(false);
    expect(isDbTable({ type: 'service' })).toBe(false);
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
      expect(PACKS.map((p) => packTypeCount(p.id))).toEqual([7, 3, 2, 1, 1, 11]);
      expect(packTypeCount('nope')).toBe(0);
    });
  });

  describe('Basic shapes pack (031)', () => {
    const table = [
      ['rectangle', 'Rectangle', 'rect', [160, 72], [64, 40]],
      ['rounded-rectangle', 'Rounded rectangle', 'rounded-rect', [160, 72], [64, 40]],
      ['ellipse', 'Ellipse', 'ellipse', [152, 80], [64, 40]],
      ['diamond', 'Diamond', 'diamond', [176, 112], [80, 56]],
      ['pill', 'Pill', 'stadium', [176, 52], [80, 36]],
      ['cylinder', 'Cylinder', 'cylinder', [152, 104], [64, 56]],
      ['document-shape', 'Document', 'document', [152, 96], [64, 48]],
      ['parallelogram', 'Parallelogram', 'parallelogram', [168, 72], [72, 40]],
      ['hexagon', 'Hexagon', 'hexagon', [160, 76], [72, 40]],
      ['actor', 'Actor', 'actor', [80, 112], [48, 72]],
      ['text', 'Text', 'none', [160, 40], [40, 24]],
    ] as const;

    it('holds the eleven shape types with geometry, default and minimum sizes', () => {
      expect(PACKS.find((p) => p.id === 'shapes')).toMatchObject({
        name: 'Basic shapes',
        tools: ['sticky', 'frame'],
      });
      const shapes = typesOfPacks(['shapes']);
      expect(shapes.map((t) => t.id)).toEqual(table.map(([id]) => id));
      expect(SHAPE_TYPE_IDS).toEqual(table.map(([id]) => id));
      for (const [id, name, geometry, [dw, dh], [mw, mh]] of table) {
        expect(cardType(id)).toMatchObject({
          name,
          pack: 'shapes',
          category: 'shapes',
          family: 'shape',
          geometry,
          defaultSize: { width: dw, height: dh },
          minSize: { width: mw, height: mh },
        });
      }
    });

    it('gives decision, database and document a shape form', () => {
      expect(cardType('decision')?.shapeForm).toBe('diamond');
      expect(cardType('database')?.shapeForm).toBe('cylinder');
      expect(cardType('document')?.shapeForm).toBe('document-shape');
      expect(CARD_TYPES.filter((t) => t.shapeForm !== undefined)).toHaveLength(3);
      expect(['decision', 'database', 'document'].every(hasTwoForms)).toBe(true);
      expect(['service', 'diamond', 'robot'].some(hasTwoForms)).toBe(false);
    });

    it('effectiveFamily: display only matters for types with two forms', () => {
      expect(effectiveFamily({ type: 'service' })).toBe('card');
      expect(effectiveFamily({ type: 'diamond' })).toBe('shape');
      expect(effectiveFamily({ type: 'database' })).toBe('card');
      expect(effectiveFamily({ type: 'database', display: 'shape' })).toBe('shape');
      expect(effectiveFamily({ type: 'database', display: 'card' })).toBe('card');
      expect(effectiveFamily({ type: 'service', display: 'shape' })).toBe('card');
      expect(effectiveFamily({ type: 'diamond', display: 'card' })).toBe('shape');
      expect(effectiveFamily({ type: 'robot', display: 'shape' })).toBe('card');
    });

    it('shapeGeometryOf: the geometry drawn, or null for a card', () => {
      expect(shapeGeometryOf({ type: 'diamond' })).toBe('diamond');
      expect(shapeGeometryOf({ type: 'text' })).toBe('none');
      expect(shapeGeometryOf({ type: 'database' })).toBeNull();
      expect(shapeGeometryOf({ type: 'database', display: 'shape' })).toBe('cylinder');
      expect(shapeGeometryOf({ type: 'document', display: 'shape' })).toBe('document');
      expect(shapeGeometryOf({ type: 'decision', display: 'shape' })).toBe('diamond');
      expect(shapeGeometryOf({ type: 'service', display: 'shape' })).toBeNull();
      expect(shapeGeometryOf({ type: 'robot' })).toBeNull();
    });

    it('keeps the packs of a deck saved before 031', () => {
      expect(deckPacks({ packs: ['architecture', 'process', 'logistics', 'data'] })).toEqual([
        'architecture',
        'process',
        'logistics',
        'data',
      ]);
      expect(deckPacks({})).toEqual(['architecture']);
    });
  });
});
