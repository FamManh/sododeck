import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  readFile(new URL(`../src/generated/${file}`, import.meta.url), 'utf8');

/**
 * Guards against schema constructs the generators silently drop or loosen (research R2, R4):
 * a loose generated type or validator would let invalid data through without any failing test.
 */
describe('generated code', () => {
  it('Zod has no catch-all validators and injects no defaults', async () => {
    const zod = await read('zod.ts');
    expect(zod).not.toContain('z.any()');
    expect(zod).not.toContain('z.unknown()');
    expect(zod).not.toContain('.default(');
    expect(zod).not.toContain('.passthrough(');
  });

  it('types have no open index signatures', async () => {
    const types = await read('types.ts');
    expect(types).not.toContain('[k: string]: unknown');
    expect(types).not.toMatch(/:\s*any\b/);
  });
});
