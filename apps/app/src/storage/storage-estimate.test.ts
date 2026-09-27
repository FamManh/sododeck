import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatBytes, readStorageState, requestPersistence } from './storage-estimate';

afterEach(() => {
  vi.unstubAllGlobals();
});

const storage = (patch: Partial<StorageManager>) => {
  vi.stubGlobal('navigator', { storage: patch });
};

describe('storage estimate', () => {
  it('falls back to unsupported without the Storage API', async () => {
    vi.stubGlobal('navigator', {});
    expect(await readStorageState()).toEqual({ persisted: 'unsupported' });
    expect(await requestPersistence()).toEqual({ persisted: 'unsupported' });
  });

  it('reports persisted state with usage and quota', async () => {
    storage({
      estimate: () => Promise.resolve({ usage: 1200, quota: 10_000 }),
      persisted: () => Promise.resolve(true),
      persist: () => Promise.resolve(true),
    });
    expect(await readStorageState()).toEqual({ persisted: 'on', usage: 1200, quota: 10_000 });
  });

  it('turns a refused request into declined, a granted one into on', async () => {
    storage({ persisted: () => Promise.resolve(false), persist: () => Promise.resolve(false) });
    expect(await readStorageState()).toEqual({ persisted: 'off' });
    expect(await requestPersistence()).toEqual({ persisted: 'declined' });
    storage({ persisted: () => Promise.resolve(false), persist: () => Promise.resolve(true) });
    expect(await requestPersistence()).toEqual({ persisted: 'on' });
  });

  it('formats bytes in decimal units', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1_200_000)).toBe('1.2 MB');
    expect(formatBytes(6_400_000_000)).toBe('6.4 GB');
    expect(formatBytes(74_000)).toBe('74 kB');
  });
});
