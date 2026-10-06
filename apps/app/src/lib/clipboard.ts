import {
  clipboardItemSupports,
  isApplePlatform,
  supportsClipboardItems,
  supportsClipboardWrite,
} from './features';

/**
 * Writes text to the system clipboard (feature-detected). Resolves `false` when the clipboard is
 * missing (no secure context) or the browser refuses the write; never throws.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!supportsClipboardWrite()) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The toast shown when a copy fails: the user can still copy by hand. */
export function couldNotCopyText(apple = isApplePlatform()): string {
  return `Couldn't copy — select the text and press ${apple ? '⌘C' : 'Ctrl+C'}`;
}

/**
 * Writes one rich clipboard item (copy as PNG / SVG). Each value may still be pending: the item is
 * handed to the browser at once, inside the user's gesture, and the data follows when it is ready
 * (some browsers refuse a write that starts after an await). Types the browser cannot take are
 * left out; resolves `false` when none is left, the API is missing or the write is refused.
 */
export async function copyItem(data: Readonly<Record<string, Promise<Blob>>>): Promise<boolean> {
  if (!supportsClipboardItems()) return false;
  const entries = Object.entries(data).filter(([type]) => clipboardItemSupports(type));
  if (entries.length === 0) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem(Object.fromEntries(entries))]);
    return true;
  } catch {
    return false;
  }
}
