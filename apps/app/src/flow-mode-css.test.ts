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

  it('sets --sd-dur-dim to 0 under reduced motion', () => {
    const reduced = /prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(tokensCss)?.[1];
    expect(reduced).toMatch(/--sd-dur-dim:\s*0m?s/);
  });
});
