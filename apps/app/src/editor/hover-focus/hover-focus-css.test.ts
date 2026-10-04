import { describe, expect, it } from 'vitest';

import { hoverFocusCss, relationshipRowsCss } from './hover-focus-css';

describe('hover focus rows (042 R14)', () => {
  it('lights the rows of a column focus and dims the other cards', () => {
    const css = hoverFocusCss({
      focusId: 'orders',
      members: new Set(['orders', 'customers']),
      edges: new Set(['fk']),
      rows: new Set(['orders:o.cid', 'customers:c.id']),
    });
    expect(css).toContain(
      '[data-hover-focus] :is([data-row="orders\\:o\\.cid"], [data-row="customers\\:c\\.id"]) { background: var(--color-deck-orange-soft); }',
    );
    expect(css).toContain('> span { font-weight: 600; }');
    expect(css).toContain('opacity: var(--sd-deck-dim)');
    expect(css).toContain('[data-edge-label-for="fk"])) { opacity');
  });

  it('lights nothing extra for a card focus without rows', () => {
    const css = hoverFocusCss({ focusId: 'a', members: new Set(['a']), edges: new Set() });
    expect(css).not.toContain('data-row');
  });

  it('lights a relationship’s rows and shows its hover label, without dimming', () => {
    const lines = relationshipRowsCss(new Set(['t:c']), ['fk']);
    expect(lines.join('\n')).not.toContain('opacity');
    expect(lines).toEqual([
      '[data-canvas] :is([data-row="t\\:c"]) { background: var(--color-deck-orange-soft); }',
      '[data-canvas] :is([data-row="t\\:c"]) > span { font-weight: 600; }',
      '[data-canvas] :is([data-edge-label-for="fk"]).sd-rel-hover-label { visibility: visible; }',
    ]);
  });
});
