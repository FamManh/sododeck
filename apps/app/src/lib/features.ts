/**
 * Feature detection for browser-only APIs (architecture rule 6).
 * Always branch on these; never assume an API exists.
 */
export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

export function supportsPersistentStorage(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage.persist === 'function'
  );
}

export function supportsBroadcastChannel(): boolean {
  return typeof BroadcastChannel !== 'undefined';
}

export function supportsIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

/** Apple platforms use ⌘ for shortcuts; everything else uses Ctrl. */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

export function supportsClipboardWrite(): boolean {
  // `clipboard` is missing outside secure contexts, whatever the DOM types say.
  const clipboard = (navigator as Partial<Navigator> | undefined)?.clipboard;
  return typeof clipboard?.writeText === 'function';
}

export function supportsResizeObserver(): boolean {
  return typeof ResizeObserver !== 'undefined';
}

/** `matchMedia` (compact islands in narrow windows, 018). Missing in some test environments. */
export function supportsMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

export function supportsStorageEstimate(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage.estimate === 'function'
  );
}

/**
 * True for a "storage is full" failure: the DOM `QuotaExceededError`, or Dexie's wrapper of it
 * (`name` is the same; the original sits in `inner`).
 */
export function isQuotaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('name' in error && error.name === 'QuotaExceededError') return true;
  return 'inner' in error && isQuotaError(error.inner);
}

/** Module workers (problems check, layout). Missing in jsdom; the app then checks in-process. */
export function supportsWorkers(): boolean {
  return typeof Worker !== 'undefined';
}
