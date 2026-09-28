import { supportsClipboardWrite } from './features';

export async function copyText(text: string): Promise<boolean> {
  if (!supportsClipboardWrite()) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
