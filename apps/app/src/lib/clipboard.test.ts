import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyText } from './clipboard';

afterEach(() => vi.unstubAllGlobals());

describe('copyText', () => {
  it('writes when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('returns false if denied or unavailable', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue('denied') } });
    expect(await copyText('hello')).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(await copyText('hello')).toBe(false);
  });
});
