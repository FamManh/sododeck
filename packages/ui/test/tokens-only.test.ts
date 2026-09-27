import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * FR-004 / SC-003: components take colors (and radii) only from design tokens.
 * Raw values belong in src/styles/tokens.css and theme.css, nowhere else.
 */
const componentsDir = resolve(import.meta.dirname, '../src/components');
const files = readdirSync(componentsDir).filter((name) => name.endsWith('.tsx'));

const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black';

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: 'hex color', pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'color function', pattern: /\b(rgb|rgba|hsl|hsla|oklch)\(/ },
  {
    name: 'Tailwind palette color',
    pattern: new RegExp(
      // A palette hue needs a shade (bg-amber-500); white/black stand alone. Our own tokens such
      // as bg-amber-soft share a hue name but are not palette colors.
      `\\b(bg|text|border|ring|fill|stroke|outline|from|to|via|shadow)-((${PALETTE})-\\d{2,3}|white|black)(?![-\\w])`,
    ),
  },
  { name: 'arbitrary color value', pattern: /-\[(#|rgb|hsl)/ },
  { name: 'arbitrary radius', pattern: /rounded-\[/ },
  { name: 'dark: variant', pattern: /\bdark:/ },
];

/** Every quoted string in a file: class lists live in string literals. */
function stringLiterals(source: string): string[] {
  return [...source.matchAll(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g)].map((match) => match[0]);
}

describe('components use tokens only', () => {
  it('finds component files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s has no hard-coded colors, arbitrary radii or dark: overrides', (file) => {
    const source = readFileSync(resolve(componentsDir, file), 'utf8');
    const hits = FORBIDDEN.flatMap(({ name, pattern }) => {
      const match = pattern.exec(source);
      return match ? [`${name}: ${match[0]}`] : [];
    });
    expect(hits).toEqual([]);
  });

  it.each(files)('%s never puts muted text on surface-2', (file) => {
    // Founder decision (research.md R5): ink-muted on surface-2 is 4.40:1 in light, below 4.5:1.
    const source = readFileSync(resolve(componentsDir, file), 'utf8');
    const offenders = stringLiterals(source).filter(
      (literal) => /\bbg-surface-2\b/.test(literal) && /(^|[\s:'"`])text-ink-muted\b/.test(literal),
    );
    expect(offenders).toEqual([]);
  });
});
