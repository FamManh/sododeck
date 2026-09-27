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
