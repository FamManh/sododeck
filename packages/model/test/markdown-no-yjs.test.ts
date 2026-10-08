import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

const src = fileURLToPath(new URL('../src/', import.meta.url));

/** Runtime imports of a source file (type-only imports are erased and do not count). */
function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const found: string[] = [];
  for (const m of text.matchAll(/^(?:import|export)\s(?!type\b)[^;]*?from\s+'([^']+)'/gms)) {
    found.push(m[1] ?? '');
  }
  return found;
}

it('markdown-form reaches no Yjs, directly or through its imports', () => {
  const seen = new Set<string>();
  const external = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const spec of importsOf(file)) {
      if (spec.startsWith('.')) walk(resolve(dirname(file), `${spec}.ts`));
      else external.add(spec);
    }
  };
  walk(`${src}markdown-form.ts`);
  expect([...external].sort()).not.toContain('yjs');
  expect([...external].every((s) => s.startsWith('@sododeck/'))).toBe(true);
});
