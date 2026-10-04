import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(new URL(import.meta.resolve('../index.css')), 'utf8');

/** Every `selector { body }` rule whose selector matches `pattern` (flat rules only). */
function rules(pattern: RegExp): { selector: string; body: string }[] {
  return [...indexCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selector = '', body = '']) => ({ selector: selector.trim(), body }))
    .filter(({ selector }) => pattern.test(selector));
}

describe('drag look CSS (051 US4)', () => {
  it('never rotates a dragged card or shape', () => {
    const dragged = rules(/\.dragging\s+\.sd-(card|shape-art|shape-lip)\b/);
    expect(dragged.length).toBeGreaterThan(0);
    for (const { body } of dragged) expect(body).not.toMatch(/rotate/);
  });

  it('keeps the lift: a deeper lip and the Float shadow', () => {
    const card = rules(/\.react-flow__node\.dragging\s+\.sd-card$/);
    expect(card.map((r) => r.body).join('')).toMatch(/--sd-deck-lip-drag[\s\S]*--shadow-float/);
    const lip = rules(/\.react-flow__node\.dragging\s+\.sd-shape-lip$/);
    expect(lip.map((r) => r.body).join('')).toContain('--sd-deck-lip-drag');
  });
});
