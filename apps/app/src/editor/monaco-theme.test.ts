import { readFileSync } from 'node:fs';

import { contrastRatio } from '@sododeck/ui/lib/contrast';
import { afterEach, describe, expect, it } from 'vitest';

import { buildMonacoTheme, readThemeTokens, THEME_TOKENS, type ThemeTokens } from './monaco-theme';

// By package name, never a relative path across packages. (Vitest stubs CSS, even with `?raw`.)
const tokensCss = readFileSync(new URL(import.meta.resolve('@sododeck/ui/tokens.css')), 'utf8');

/** `--sd-name: #hex;` pairs from one CSS block. */
function hexTokens(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/(--sd-[a-z0-9-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map(
      (match) => [match[1] ?? '', match[2] ?? ''] as const,
    ),
  );
}

const light = hexTokens(/:root\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '');
const dark = new Map([...light, ...hexTokens(/\.dark\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '')]);

function tokensOf(theme: Map<string, string>): ThemeTokens {
  return Object.fromEntries(
    THEME_TOKENS.map((name) => {
      const value = theme.get(name);
      if (value === undefined) throw new Error(`Missing token ${name}`);
      return [name, value];
    }),
  ) as ThemeTokens;
}

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('readThemeTokens', () => {
  it('reads each token from the computed style, trimmed', () => {
    for (const name of THEME_TOKENS) document.documentElement.style.setProperty(name, ' #123456');
    const tokens = readThemeTokens();
    expect(Object.keys(tokens).sort()).toEqual([...THEME_TOKENS].sort());
    expect(Object.values(tokens).every((value) => value === '#123456')).toBe(true);
  });
});

describe.each([
  ['light', light, 'vs'],
  ['dark', dark, 'vs-dark'],
] as const)('buildMonacoTheme (%s)', (_name, theme, base) => {
  const tokens = tokensOf(theme);
  const built = buildMonacoTheme(tokens, base);
  const background = tokens['--sd-code'];

  it('uses the code surface for the editor and the gutter', () => {
    expect(built.base).toBe(base);
    expect(built.inherit).toBe(true);
    expect(built.colors['editor.background']).toBe(background);
    expect(built.colors['editorGutter.background']).toBe(background);
  });

  it('colors every JSON token kind', () => {
    const scopes = built.rules.map((rule) => rule.token);
    for (const scope of ['string.key.json', 'string.value.json', 'number', 'keyword', 'delimiter'])
      expect(scopes).toContain(scope);
  });

  it('gives every syntax foreground at least 4.5:1 on the code surface', () => {
    const foregrounds = [
      ...built.rules.flatMap((rule) => (rule.foreground ? [`#${rule.foreground}`] : [])),
      built.colors['editor.foreground'],
      built.colors['editorLineNumber.foreground'],
    ];
    for (const fg of foregrounds) {
      expect(fg).toBeDefined();
      expect(contrastRatio(fg ?? '', background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
