import { afterEach, describe, expect, it, vi } from 'vitest';

import { supportsFileSystemAccess, supportsPersistentStorage } from './features';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('feature detection', () => {
  it('detects the File System Access API', () => {
    expect(supportsFileSystemAccess()).toBe(false); // jsdom
    vi.stubGlobal('showSaveFilePicker', () => undefined);
    expect(supportsFileSystemAccess()).toBe(true);
  });

  it('detects navigator.storage.persist', () => {
    vi.stubGlobal('navigator', {});
    expect(supportsPersistentStorage()).toBe(false);
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.resolve(true) } });
    expect(supportsPersistentStorage()).toBe(true);
  });
});
