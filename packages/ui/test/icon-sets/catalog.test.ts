import { describe, expect, it } from 'vitest';

import { LUCIDE_CATALOG, LUCIDE_CATEGORIES } from '../../src/icon-sets/lucide-catalog';
import { lucide } from '../../src/icon-sets/lucide';
import { TYPE_FALLBACK, TYPE_STYLE } from '../../src/lib/icons';

describe('lucide catalog', () => {
  it('has about 300 entries', () => {
    expect(LUCIDE_CATALOG.length).toBeGreaterThanOrEqual(250);
    expect(LUCIDE_CATALOG.length).toBeLessThanOrEqual(350);
  });

  it('has unique, well-formed names', () => {
    const names = LUCIDE_CATALOG.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z0-9-]+$/);
  });

  it('uses only known categories and every category', () => {
    const ids = new Set(LUCIDE_CATEGORIES.map((c) => c.id));
    expect(LUCIDE_CATEGORIES.map((c) => c.label)).toEqual([
      'Compute',
      'Data',
      'Network',
      'Cloud',
      'Security',
      'People',
      'Devices',
      'Messaging',
      'Files',
      'Business',
      'Logistics',
      'Status & Shapes',
    ]);
    for (const entry of LUCIDE_CATALOG) expect(ids).toContain(entry.category);
    const used = new Set(LUCIDE_CATALOG.map((e) => e.category));
    for (const id of ids) expect(used).toContain(id);
  });

  it('has lowercase keywords and a label for every entry', () => {
    for (const entry of LUCIDE_CATALOG) {
      expect(entry.label.length).toBeGreaterThan(0);
      for (const keyword of entry.keywords) expect(keyword).toBe(keyword.toLowerCase());
    }
  });

  it('has generated geometry for every entry', () => {
    for (const icon of lucide.icons) expect(icon.node.length, icon.name).toBeGreaterThan(0);
    expect(lucide.icons).toHaveLength(LUCIDE_CATALOG.length);
  });

  it('contains every type icon and the fallback', () => {
    const names = new Set(LUCIDE_CATALOG.map((e) => e.name));
    for (const [id, style] of Object.entries(TYPE_STYLE)) {
      expect(names, id).toContain(style.iconName);
    }
    expect(names).toContain(TYPE_FALLBACK.iconName);
  });
});
