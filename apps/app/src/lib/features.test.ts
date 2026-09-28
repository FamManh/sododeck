import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isApplePlatform,
  isQuotaError,
  supportsClipboardWrite,
  supportsFileSystemAccess,
  supportsMatchMedia,
  supportsPersistentStorage,
  supportsResizeObserver,
  supportsStorageEstimate,
} from './features';

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

  it('detects navigator.clipboard.writeText', () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
    expect(supportsClipboardWrite()).toBe(true);
    vi.stubGlobal('navigator', {});
    expect(supportsClipboardWrite()).toBe(false);
    vi.stubGlobal('navigator', undefined);
    expect(supportsClipboardWrite()).toBe(false);
  });

  it('detects matchMedia', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(supportsMatchMedia()).toBe(true);
    vi.stubGlobal('matchMedia', undefined);
    expect(supportsMatchMedia()).toBe(false);
  });

  it('detects ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', function ResizeObserver() {});
    expect(supportsResizeObserver()).toBe(true);
    vi.stubGlobal('ResizeObserver', undefined);
    expect(supportsResizeObserver()).toBe(false);
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

  it('detects navigator.storage.estimate', () => {
    vi.stubGlobal('navigator', {});
    expect(supportsStorageEstimate()).toBe(false);
    vi.stubGlobal('navigator', { storage: { estimate: () => Promise.resolve({}) } });
    expect(supportsStorageEstimate()).toBe(true);
  });

  it('recognizes quota errors, also wrapped by Dexie', () => {
    expect(isQuotaError(new DOMException('full', 'QuotaExceededError'))).toBe(true);
    expect(isQuotaError({ name: 'QuotaExceededError', inner: null })).toBe(true);
    expect(isQuotaError({ name: 'AbortError', inner: { name: 'QuotaExceededError' } })).toBe(true);
    expect(isQuotaError(new DOMException('gone', 'NotFoundError'))).toBe(false);
    expect(isQuotaError('QuotaExceededError')).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});
