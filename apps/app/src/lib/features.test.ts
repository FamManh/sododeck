import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clipboardItemSupports,
  isApplePlatform,
  isQuotaError,
  resetWorkerSupportForTests,
  supportsClipboardItems,
  supportsClipboardRead,
  supportsCreateImageBitmap,
  supportsCryptoSubtle,
  supportsOffscreenCanvas,
  supportsClipboardWrite,
  supportsFileSystemAccess,
  supportsIdleCallback,
  supportsMatchMedia,
  supportsResizeObserver,
  supportsWorkers,
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

  it('detects navigator.clipboard.writeText', () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
    expect(supportsClipboardWrite()).toBe(true);
    vi.stubGlobal('navigator', {});
    expect(supportsClipboardWrite()).toBe(false);
    vi.stubGlobal('navigator', undefined);
    expect(supportsClipboardWrite()).toBe(false);
  });

  it('detects clipboard items and the types they take (copy as PNG / SVG)', () => {
    const write = () => Promise.resolve();
    vi.stubGlobal('navigator', { clipboard: { write } });
    expect(supportsClipboardItems()).toBe(false); // no ClipboardItem in jsdom
    expect(clipboardItemSupports('image/png')).toBe(false);
    vi.stubGlobal('ClipboardItem', vi.fn());
    expect(supportsClipboardItems()).toBe(true);
    // Without `ClipboardItem.supports`: only the types every such browser takes.
    expect(clipboardItemSupports('image/png')).toBe(true);
    expect(clipboardItemSupports('image/svg+xml')).toBe(false);
    vi.stubGlobal(
      'ClipboardItem',
      Object.assign(vi.fn(), { supports: (type: string) => type === 'image/svg+xml' }),
    );
    expect(clipboardItemSupports('image/svg+xml')).toBe(true);
    expect(clipboardItemSupports('image/png')).toBe(false);
  });

  it('detects clipboard reading (016: the menu Paste item)', () => {
    vi.stubGlobal('navigator', { clipboard: { readText: () => Promise.resolve('') } });
    expect(supportsClipboardRead()).toBe(true);
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
    expect(supportsClipboardRead()).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(supportsClipboardRead()).toBe(false);
    vi.stubGlobal('navigator', undefined);
    expect(supportsClipboardRead()).toBe(false);
  });

  it('detects matchMedia', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(supportsMatchMedia()).toBe(true);
    vi.stubGlobal('matchMedia', undefined);
    expect(supportsMatchMedia()).toBe(false);
  });

  it('detects requestIdleCallback', () => {
    vi.stubGlobal('requestIdleCallback', () => 1);
    expect(supportsIdleCallback()).toBe(true);
    vi.stubGlobal('requestIdleCallback', undefined);
    expect(supportsIdleCallback()).toBe(false);
  });

  it('detects ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', function ResizeObserver() {});
    expect(supportsResizeObserver()).toBe(true);
    vi.stubGlobal('ResizeObserver', undefined);
    expect(supportsResizeObserver()).toBe(false);
  });
});

describe('isApplePlatform', () => {
  it('detects Apple platforms from navigator.appVersion', () => {
    const spy = vi.spyOn(navigator, 'appVersion', 'get');
    spy.mockReturnValue('5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    expect(isApplePlatform()).toBe(true);
    spy.mockReturnValue('5.0 (Windows NT 10.0; Win64; x64)');
    expect(isApplePlatform()).toBe(false);
    spy.mockRestore();
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

describe('picture feature detection (055)', () => {
  it('detects createImageBitmap, OffscreenCanvas and crypto.subtle', () => {
    vi.stubGlobal('createImageBitmap', undefined);
    expect(supportsCreateImageBitmap()).toBe(false);
    vi.stubGlobal('createImageBitmap', () => Promise.resolve({}));
    expect(supportsCreateImageBitmap()).toBe(true);

    vi.stubGlobal('OffscreenCanvas', undefined);
    expect(supportsOffscreenCanvas()).toBe(false);
    vi.stubGlobal('OffscreenCanvas', function OffscreenCanvas() {});
    expect(supportsOffscreenCanvas()).toBe(false);
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        convertToBlob() {
          return Promise.resolve(new Blob());
        }
      },
    );
    expect(supportsOffscreenCanvas()).toBe(true);

    vi.stubGlobal('crypto', {});
    expect(supportsCryptoSubtle()).toBe(false);
    vi.stubGlobal('crypto', { subtle: { digest: () => Promise.resolve(new ArrayBuffer(0)) } });
    expect(supportsCryptoSubtle()).toBe(true);
  });

  it('probes AVIF decoding once and caches the answer', async () => {
    vi.resetModules();
    const { supportsAvifDecode } = await import('./features');
    const decode = vi.fn(() => Promise.resolve({ close: vi.fn() }));
    vi.stubGlobal('createImageBitmap', decode);
    expect(await supportsAvifDecode()).toBe(true);
    expect(await supportsAvifDecode()).toBe(true);
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('reports no AVIF when the probe cannot decode or there is no createImageBitmap', async () => {
    vi.resetModules();
    const failing = await import('./features');
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('no avif')));
    expect(await failing.supportsAvifDecode()).toBe(false);

    vi.resetModules();
    const missing = await import('./features');
    vi.stubGlobal('createImageBitmap', undefined);
    expect(await missing.supportsAvifDecode()).toBe(false);
  });
});

describe('supportsWorkers (067 R14)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetWorkerSupportForTests();
  });

  it('is false when constructing a module worker throws (sandboxed frame), and remembers it', () => {
    const construct = vi.fn(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.stubGlobal('Worker', construct);
    URL.createObjectURL = vi.fn(() => 'blob:probe');
    URL.revokeObjectURL = vi.fn();
    resetWorkerSupportForTests();
    expect(supportsWorkers()).toBe(false);
    expect(supportsWorkers()).toBe(false);
    expect(construct).toHaveBeenCalledTimes(1);
  });

  it('is true when a module worker can be constructed', () => {
    const terminate = vi.fn();
    vi.stubGlobal(
      'Worker',
      class {
        terminate = terminate;
      },
    );
    URL.createObjectURL = vi.fn(() => 'blob:probe');
    URL.revokeObjectURL = vi.fn();
    resetWorkerSupportForTests();
    expect(supportsWorkers()).toBe(true);
    expect(terminate).toHaveBeenCalled();
  });

  it('is false without a Worker', () => {
    vi.stubGlobal('Worker', undefined);
    resetWorkerSupportForTests();
    expect(supportsWorkers()).toBe(false);
  });
});
