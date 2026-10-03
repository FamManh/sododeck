import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(new URL(import.meta.resolve('./index.css')), 'utf8');
const tokensCss = readFileSync(new URL(import.meta.resolve('@sododeck/ui/tokens.css')), 'utf8');

describe('flow mode dimming CSS (007 FR-003, FR-024)', () => {
  it('fades with the --sd-dur-dim token, never a literal duration', () => {
    const transitions = [...indexCss.matchAll(/\[data-flow-mode\][^{]*\{([^}]*)\}/g)]
      .map((m) => m[1] ?? '')
      .filter((body) => body.includes('transition'));
    expect(transitions.length).toBeGreaterThan(0);
    for (const body of transitions) {
      expect(body).toMatch(/transition:\s*opacity var\(--sd-dur-dim\)/);
      expect(body).not.toMatch(/\d+m?s/);
    }
  });

  it('hides handles without display: none, which would break edge drawing', () => {
    const rules = [...indexCss.matchAll(/(\[data-flow-mode\][^{]*)\{([^}]*)\}/g)];
    const handles = rules.find((m) => (m[1] ?? '').includes('.react-flow__handle'));
    expect(handles?.[2]).toMatch(/visibility:\s*hidden/);
    for (const rule of rules) expect(rule[2]).not.toMatch(/display:\s*none/);
  });

  it('sets --sd-dur-dim to 0 under reduced motion', () => {
    const reduced = /prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(tokensCss)?.[1];
    expect(reduced).toMatch(/--sd-dur-dim:\s*0m?s/);
  });

  it('dims note nodes to 35%, restores them on hover or focus, and uses a dashed token border', () => {
    expect(indexCss).toMatch(
      /\[data-flow-mode\]\s+\.react-flow__node\.sd-note-dimmed\s*\{[^}]*opacity:\s*0\.35[^}]*transition:\s*opacity var\(--sd-dur-dim\)[^}]*border-style:\s*dashed/is,
    );
    expect(indexCss).toMatch(
      /\[data-flow-mode\]\s+\.react-flow__node\.sd-note-dimmed:(hover|focus-within)[^{]*\{[^}]*opacity:\s*1/is,
    );
  });
});

/** The body of the first rule whose selector list matches `selector`. */
function ruleBody(css: string, selector: RegExp): string {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selector.test(m[1] ?? '')) return m[2] ?? '';
  }
  return '';
}

describe('flow playback Deck look CSS (035)', () => {
  it('dims off-path cards with the token and off-path connectors with the edge token', () => {
    const cards = ruleBody(indexCss, /\[data-flow-mode\]\s+\.react-flow__node:not\(\.in-flow\)/);
    expect(cards).toMatch(/opacity:\s*var\(--color-deck-dim\)/);
    const edges = ruleBody(indexCss, /\[data-flow-mode\]\s+\.react-flow__edge:not\(\.in-flow\)/);
    expect(edges).toMatch(/opacity:\s*var\(--color-deck-dim-edge\)/);
    expect(edges).not.toMatch(/--color-deck-dim\)/);
  });

  it('leaves no literal opacity in the flow-mode dim rules', () => {
    const rules = [...indexCss.matchAll(/(\[data-flow-mode\][^{]*:not\([^{]*)\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule[2]).not.toMatch(/opacity:\s*[\d.]+\s*;/);
  });

  it('defines the edge dim and the current lip as tokens, not in index.css', () => {
    expect(tokensCss).toMatch(/--sd-deck-dim-edge:\s*0\.2\s*;/);
    expect(tokensCss).toMatch(/--sd-deck-lip-current:\s*5px\s*;/);
    expect(indexCss).not.toMatch(/--sd-deck-lip-current:\s*\d/);
  });

  it('keeps the current card lip below 60 % zoom: lipless zeroes the other three only', () => {
    const lipless = ruleBody(indexCss, /^\s*\[data-lipless\]\s*$/);
    expect(lipless).toMatch(/--sd-deck-lip:\s*0px/);
    expect(lipless).toMatch(/--sd-deck-lip-hover:\s*0px/);
    expect(lipless).toMatch(/--sd-deck-lip-drag:\s*0px/);
    expect(lipless).not.toMatch(/--sd-deck-lip-current/);
  });

  it('gives the current card its lip and the Orange Soft halo', () => {
    const current = ruleBody(indexCss, /\.sd-card\.current-step/);
    expect(current).toMatch(/--sd-deck-lip-current/);
    expect(current).toMatch(/--color-deck-orange-soft/);
    expect(current).toMatch(/9px/);
  });

  it('eases lift, sticker and halo only with duration tokens, which are 0 under reduced motion', () => {
    const sticker = ruleBody(indexCss, /^\s*\.sd-step-sticker\s*$/);
    expect(sticker).toMatch(/transition:/);
    for (const m of indexCss.matchAll(/transition:([^;]*);/g)) {
      expect(m[1]).not.toMatch(/\b\d+(\.\d+)?m?s\b/);
    }
    const reduced = /prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(tokensCss)?.[1];
    expect(reduced).toMatch(/--sd-dur-hover:\s*0m?s/);
    expect(reduced).toMatch(/--sd-dur-dim:\s*0m?s/);
  });

  it('drops the pulsing flow-inside dot', () => {
    expect(indexCss).not.toContain('sd-flow-inside-dot');
  });
});
