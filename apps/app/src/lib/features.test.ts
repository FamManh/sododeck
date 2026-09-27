import { afterEach, describe, expect, it, vi } from 'vitest';

import { isApplePlatform, supportsFileSystemAccess, supportsPersistentStorage } from './features';

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

describe('isApplePlatform', () => {
  it('detects Apple platforms from navigator.platform', () => {
    const spy = vi.spyOn(navigator, 'platform', 'get');
    spy.mockReturnValue('MacIntel');
    expect(isApplePlatform()).toBe(true);
    spy.mockReturnValue('Win32');
    expect(isApplePlatform()).toBe(false);
    spy.mockRestore();
  });
});
