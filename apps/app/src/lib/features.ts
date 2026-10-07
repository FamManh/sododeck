/**
 * Feature detection for browser-only APIs (architecture rule 6).
 * Always branch on these; never assume an API exists.
 */
export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
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

/**
 * `navigator.clipboard.write` with `ClipboardItem` (copy as PNG / SVG): rich clipboard items.
 * Missing outside secure contexts and in older browsers.
 */
export function supportsClipboardItems(): boolean {
  const clipboard = (navigator as Partial<Navigator> | undefined)?.clipboard;
  return typeof clipboard?.write === 'function' && typeof ClipboardItem === 'function';
}

/**
 * Whether a `ClipboardItem` may carry `type`. Uses `ClipboardItem.supports` where the browser has
 * it; without it, only the types every clipboard-item browser takes (`text/plain`, `image/png`).
 */
export function clipboardItemSupports(type: string): boolean {
  if (!supportsClipboardItems()) return false;
  const supports = (ClipboardItem as { supports?: (type: string) => boolean }).supports;
  if (typeof supports === 'function') return supports.call(ClipboardItem, type);
  return type === 'text/plain' || type === 'image/png';
}

/** `navigator.clipboard.readText` (016: the menu's Paste; ⌘V uses the paste event instead). */
export function supportsClipboardRead(): boolean {
  const clipboard = (navigator as Partial<Navigator> | undefined)?.clipboard;
  return typeof clipboard?.readText === 'function';
}

export function supportsResizeObserver(): boolean {
  return typeof ResizeObserver !== 'undefined';
}

/** `matchMedia` (compact islands in narrow windows, 018). Missing in some test environments. */
export function supportsMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
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

/** Module workers (problems check, layout, schema import). Missing in jsdom; the app then checks in-process. */
export function supportsWorkers(): boolean {
  if (typeof Worker === 'undefined') return false;
  workersUsable ??= canConstructWorker();
  return workersUsable;
}

let workersUsable: boolean | undefined;

/**
 * A sandboxed frame (an embed inside a host, 067) can forbid workers by throwing on construction;
 * the in-process fallbacks then take over. Probed once with an empty module worker.
 */
function canConstructWorker(): boolean {
  let url: string | undefined;
  try {
    url = URL.createObjectURL(new Blob([''], { type: 'text/javascript' }));
    new Worker(url, { type: 'module' }).terminate();
    return true;
  } catch {
    return false;
  } finally {
    if (url !== undefined) URL.revokeObjectURL(url);
  }
}

/** Forgets the probe result (tests). */
export function resetWorkerSupportForTests(): void {
  workersUsable = undefined;
}

/** `requestIdleCallback` (prefetching the export chunk, 012). Missing in older Safari. */
export function supportsIdleCallback(): boolean {
  return typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';
}

/** `createImageBitmap` (picture decode off the main thread, 055). */
export function supportsCreateImageBitmap(): boolean {
  return typeof createImageBitmap === 'function';
}

/** `OffscreenCanvas` with `convertToBlob` (picture scale and encode in a worker, 055). */
export function supportsOffscreenCanvas(): boolean {
  return (
    typeof OffscreenCanvas !== 'undefined' &&
    typeof OffscreenCanvas.prototype.convertToBlob === 'function'
  );
}

/** `crypto.subtle` (SHA-256 of a picture, 055). Missing outside secure contexts. */
export function supportsCryptoSubtle(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof (crypto as Partial<Crypto>).subtle?.digest === 'function'
  );
}

/** A 2 x 2 AVIF; decoding it proves the browser reads AVIF. */
const AVIF_PROBE =
  'AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';

let avifProbe: Promise<boolean> | null = null;

/** Whether this browser decodes AVIF. Probed once with a tiny file; `false` when unsupported. */
export function supportsAvifDecode(): Promise<boolean> {
  if (!supportsCreateImageBitmap()) return Promise.resolve(false);
  avifProbe ??= (async () => {
    try {
      const bytes = Uint8Array.from(atob(AVIF_PROBE), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/avif' }));
      bitmap.close();
      return true;
    } catch {
      return false;
    }
  })();
  return avifProbe;
}
