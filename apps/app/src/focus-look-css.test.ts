import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(new URL(import.meta.resolve('./index.css')), 'utf8');

/** Every rule whose selector list contains `needle`, as [selector, body]. */
function rulesWith(needle: string): [string, string][] {
  return [...indexCss.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .map((m): [string, string] => [(m[1] ?? '').trim(), m[2] ?? ''])
    .filter(([selector]) => selector.includes(needle));
}

describe('connection focus look (034 R2)', () => {
  const lit = rulesWith('[data-focus-mode] .react-flow__edge.in-focus');

  it('lights a pinned-focus connector Ink at 2.75 px', () => {
    const colour = lit.find(([, body]) => body.includes('--sd-edge-hl-stroke'));
    const weight = lit.find(([, body]) => body.includes('--sd-edge-hl-width'));
    expect(colour?.[1]).toMatch(/--sd-edge-hl-stroke:\s*var\(--color-ink\)/);
    expect(weight?.[1]).toMatch(/--sd-edge-hl-width:\s*2\.75px/);
  });

  it('sets colour and weight in separate declarations, so 022 can drop one (FR-002)', () => {
    for (const [, body] of lit) {
      const sets = ['--sd-edge-hl-stroke', '--sd-edge-hl-width'].filter((name) =>
        body.includes(name),
      );
      expect(sets.length).toBeLessThanOrEqual(1);
    }
  });

  it('dims non-member cards to --sd-deck-dim and connectors and labels to the edge token', () => {
    const cards = rulesWith('[data-focus-mode] .react-flow__node:not(.in-focus)');
    expect(cards.some(([, body]) => /opacity:\s*var\(--sd-deck-dim\)/.test(body))).toBe(true);
    const edges = rulesWith('[data-focus-mode] .react-flow__edge:not(.in-focus)');
    expect(edges.some(([, body]) => /opacity:\s*var\(--color-deck-dim-edge\)/.test(body))).toBe(
      true,
    );
    const labels = rulesWith("[data-focus-mode] [data-testid='edge-label']:not([data-in-focus])");
    expect(labels.some(([, body]) => /opacity:\s*var\(--color-deck-dim-edge\)/.test(body))).toBe(
      true,
    );
  });

  it('gives neighbour cards, not the focus card, the Secondary border and lip', () => {
    const rule = rulesWith('.react-flow__node.sd-focus-neighbour .sd-card')[0];
    expect(rule?.[1]).toMatch(/border-color:\s*var\(--color-ink-secondary\)/);
    expect(rule?.[1]).toMatch(/--card-lip:\s*var\(--color-ink-secondary\)/);
    expect(indexCss).not.toMatch(/\.react-flow__node\.in-focus \.sd-card/);
  });

  it('fades with the --sd-dur-dim token, never a literal duration', () => {
    const transitions = [...indexCss.matchAll(/\[data-focus-mode\][^{]*\{([^}]*)\}/g)]
      .map((m) => m[1] ?? '')
      .filter((body) => body.includes('transition'));
    expect(transitions.length).toBeGreaterThan(0);
    for (const body of transitions) {
      expect(body).toMatch(/transition:\s*opacity var\(--sd-dur-dim\)/);
      expect(body).not.toMatch(/\d+m?s/);
    }
  });
});
