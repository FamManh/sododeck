import { CARD_TYPES } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { defaultSize, SHAPE_TYPE, type MermaidShape } from './shape-map';

describe('SHAPE_TYPE', () => {
  it.each([
    ['bare', 'rectangle'],
    ['rect', 'rectangle'],
    ['round', 'rounded-rectangle'],
    ['stadium', 'pill'],
    ['subroutine', 'rectangle'],
    ['cylinder', 'cylinder'],
    ['circle', 'ellipse'],
    ['double-circle', 'ellipse'],
    ['asymmetric', 'document-shape'],
    ['rhombus', 'diamond'],
    ['hexagon', 'hexagon'],
    ['parallelogram', 'parallelogram'],
    ['trapezoid', 'rectangle'],
  ] as [MermaidShape, string][])('%s → %s', (shape, type) => {
    expect(SHAPE_TYPE[shape]).toBe(type);
  });

  it('only produces type ids that exist in CARD_TYPES', () => {
    const known = new Set(CARD_TYPES.map((t) => t.id));
    for (const type of Object.values(SHAPE_TYPE)) expect(known.has(type)).toBe(true);
  });
});

describe('defaultSize', () => {
  it('reads the registry', () => {
    expect(defaultSize('diamond')).toEqual({ width: 176, height: 112 });
    expect(defaultSize('rectangle')).toEqual({ width: 160, height: 72 });
  });

  it('every produced type has a registry size', () => {
    for (const type of new Set(Object.values(SHAPE_TYPE))) {
      expect(CARD_TYPES.find((t) => t.id === type)?.defaultSize).toBeDefined();
    }
  });
});
