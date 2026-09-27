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
