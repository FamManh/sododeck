import { CARD_TYPES } from '@sododeck/model';
import { TYPE_STYLE } from '@sododeck/ui/lib/icons';
import { describe, expect, it } from 'vitest';

import { ICON_PATHS } from './export/icon-paths';

describe('type registry parity (030)', () => {
  it.each(CARD_TYPES.map((type) => type.id))('%s has a tile style and an export icon', (id) => {
    expect(TYPE_STYLE[id]).toBeDefined();
    expect(Object.hasOwn(ICON_PATHS, id)).toBe(true);
  });
});
