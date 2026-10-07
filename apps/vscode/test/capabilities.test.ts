import { describe, expect, it } from 'vitest';

import { computeCapabilities } from '../src/capabilities';

const ok = { setting: 'file', untitled: false, trusted: true, writable: true } as const;

describe('computeCapabilities', () => {
  it('declares links and exports always', () => {
    expect(computeCapabilities({ ...ok, setting: 'embed' })).toEqual({
      openLinks: true,
      exportFiles: true,
      pictures: false,
    });
  });

  it('declares pictures only for the file setting, a saved deck, a trusted workspace and a writable folder', () => {
    expect(computeCapabilities(ok).pictures).toBe(true);
    expect(computeCapabilities({ ...ok, setting: 'embed' }).pictures).toBe(false);
    expect(computeCapabilities({ ...ok, untitled: true }).pictures).toBe(false);
    expect(computeCapabilities({ ...ok, trusted: false }).pictures).toBe(false);
    expect(computeCapabilities({ ...ok, writable: false }).pictures).toBe(false);
  });
});
