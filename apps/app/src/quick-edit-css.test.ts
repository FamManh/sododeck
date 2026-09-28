import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(new URL(import.meta.resolve('./index.css')), 'utf8');

describe('card details button CSS (019 FR-018)', () => {
  it('hides the button under every canvas flag and on a dragged card', () => {
    const rule = /([^{}]*\.sd-details-button[^{]*)\{([^}]*)\}/.exec(indexCss);
    const selectors = rule?.[1] ?? '';
    for (const flag of [
      '[data-dragging]',
      '[data-flow-mode]',
      '[data-flow-session]',
      '[data-view-only]',
      '[data-hide-ui]',
      '[data-tiny-cards]',
      '.react-flow__node.dragging',
    ]) {
      expect(selectors).toContain(flag);
    }
    expect(rule?.[2]).toMatch(/visibility:\s*hidden/);
  });
});
