import { describe, expect, it } from 'vitest';

import { SHORTCUTS } from '../shell/shortcuts';
import { ACTIONS } from './index';

describe('ACTIONS', () => {
  it('has unique ids', () => {
    const ids = ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only shortcuts from SHORTCUTS', () => {
    const known = new Set<string>(SHORTCUTS.map((s) => s.id));
    for (const action of ACTIONS) {
      if (action.shortcut !== undefined) expect(known.has(action.shortcut), action.id).toBe(true);
    }
  });

  it('offers every action on at least one surface and target', () => {
    for (const action of ACTIONS) {
      const kinds = [...(action.where.menu ?? []), ...(action.where.toolbar ?? [])];
      expect(kinds.length, action.id).toBeGreaterThan(0);
    }
  });
});
