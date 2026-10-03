import { CARD_TYPES } from '@sododeck/model';
import { TYPE_STYLE } from '@sododeck/ui/lib/icons';
import { describe, expect, it } from 'vitest';

import { ICON_PATHS } from './export/icon-paths';

const cards = CARD_TYPES.filter((type) => type.family === 'card').map((type) => type.id);
const shapes = CARD_TYPES.filter((type) => type.family === 'shape');

describe('type registry parity (030, 031)', () => {
  it.each(cards)('%s has a tile style and an export icon', (id) => {
    expect(TYPE_STYLE[id]).toBeDefined();
    expect(Object.hasOwn(ICON_PATHS, id)).toBe(true);
  });

  // Shapes draw a mini outline instead of an icon (031 contract): a geometry and sizes, no glyph.
  it.each(shapes.map((type) => [type.id, type] as const))(
    '%s has a geometry and sizes instead of an icon',
    (id, type) => {
      expect(type.geometry).toBeDefined();
      expect(type.defaultSize).toBeDefined();
      expect(type.minSize).toBeDefined();
      expect(TYPE_STYLE[id]).toBeUndefined();
    },
  );
});
