import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { menuContentClass } from '../src/lib/menu';
import { cn } from '../src/lib/utils';

const read = (file: string) =>
  readFileSync(resolve(import.meta.dirname, '../src/styles', file), 'utf8');
const tokensCss = read('tokens.css');
const themeCss = read('theme.css');
const stylesCss = read('styles.css');

/** The `--sd-*` names declared in one block (`:root {` or `.dark {`). */
function names(selector: string): Set<string> {
  const start = tokensCss.indexOf(`${selector} {`);
  const body = tokensCss.slice(start, tokensCss.indexOf('\n}', start));
  return new Set([...body.matchAll(/(--sd-[\w-]+):/g)].map((match) => match[1] ?? ''));
}

describe('token parity', () => {
  it('every dark token also exists in light', () => {
    const light = names(':root');
    const missing = [...names('.dark')].filter((name) => !light.has(name));
    expect(missing).toEqual([]);
  });

  it('defines the inline-edit selection colour in both themes (019)', () => {
    expect(names(':root').has('--sd-selection-text')).toBe(true);
    expect(names('.dark').has('--sd-selection-text')).toBe(true);
    expect(stylesCss).toMatch(/\[data-slot='inline-edit'\]::selection/);
  });

  it('menus and toolbar popovers use the menu shadow (DESIGN.md Float, 019)', () => {
    expect(themeCss).toMatch(/--shadow-menu: 0 12px 32px var\(--sd-shadow\);/);
    expect(menuContentClass).toContain('shadow-menu');
    expect(menuContentClass).not.toContain('shadow-float');
    // tailwind-merge knows the key: a later shadow replaces it instead of adding a second one.
    expect(cn('shadow-menu', 'shadow-rest')).toBe('shadow-rest');
  });
});
