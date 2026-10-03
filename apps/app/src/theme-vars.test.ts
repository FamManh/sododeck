import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const themeCss = readFileSync(new URL(import.meta.resolve('@sododeck/ui/styles.css')), 'utf8');
const themeFile = readFileSync(
  new URL('theme.css', new URL(import.meta.resolve('@sododeck/ui/styles.css'))),
  'utf8',
);
const indexCss = readFileSync(new URL(import.meta.resolve('./index.css')), 'utf8');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('theme colour variables', () => {
  it('every var(--color-…) the app writes exists in the theme (merged edges were invisible)', () => {
    const defined = new Set(
      [...`${themeCss}\n${themeFile}\n${indexCss}`.matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map(
        (m) => m[1],
      ),
    );
    const used = new Set(
      sources(import.meta.dirname).flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(/var\((--color-[a-z0-9-]+)/g)].map((m) => m[1]),
      ),
    );
    // `--color-card-${name}-${channel}` and `--color-card-text-${dark|light}` are built at
    // runtime; the ui package's token-parity test covers them.
    const missing = [...used].filter(
      (name) => name !== '--color-card-' && name !== '--color-card-text-' && !defined.has(name),
    );
    expect(missing).toEqual([]);
  });
});
