import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { build, GENERATED_PATH, NOTICES_PATH } from '../../scripts/generate-icons';

describe('generated icon files', () => {
  it('lucide.generated.ts matches the installed lucide-react', async () => {
    const { generated } = await build();
    expect(readFileSync(GENERATED_PATH, 'utf8'), 'stale: run pnpm icons:generate').toBe(generated);
  });

  it('third-party-notices.txt matches the installed LICENSE', async () => {
    const { notices } = await build();
    const current = readFileSync(NOTICES_PATH, 'utf8');
    expect(current, 'stale: run pnpm icons:generate').toBe(notices);
    expect(current).toMatch(/^lucide-react \d+\.\d+\.\d+ \(ISC\)/);
    expect(current).toContain('Permission to use, copy, modify');
  });
});
