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

  it('emits every named card colour, which the app only names at runtime (020)', () => {
    // `var(--color-card-${name}-${channel})` is invisible to Tailwind: without `static` the
    // unused names are dropped and the picker swatches and card strokes render empty.
    const start = themeCss.indexOf('@theme inline static {');
    expect(start).toBeGreaterThan(-1);
    const block = themeCss.slice(start, themeCss.indexOf('\n}', start));
    const outside = themeCss.slice(0, start) + themeCss.slice(start + block.length);
    expect(outside).not.toMatch(/--color-card-(\w+-(fill|stroke)|text-)/);
    for (const [, name] of tokensCss.matchAll(/--sd-(card-[\w-]+):/g)) {
      expect(block).toContain(`--color-${name ?? ''}: var(--sd-${name ?? ''});`);
    }
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
