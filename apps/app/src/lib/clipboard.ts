import { isApplePlatform, supportsClipboardWrite } from './features';

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
