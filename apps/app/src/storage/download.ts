const FALLBACK_NAME = 'Untitled deck';
const MAX_NAME_LENGTH = 100;

/** The extension of a saved deck file. Older `.sododeck.json` and plain `.json` files still open. */
export const DECK_EXTENSION = '.sododeck';
const LEGACY_EXTENSION = '.sododeck.json';
/** The Markdown note form of a deck (070): a readable note that also holds the whole deck. */
export const DECK_MARKDOWN_EXTENSION = '.sododeck.md';

/**
 * A deck name made safe for a download file name (research R14): characters that file systems
 * refuse (`/\:*?"<>|`) and control characters become `-`, runs of spaces collapse, and the result
 * is trimmed to 100 characters. The caller adds `.sododeck` (use `deckFileName`).
 */
export function safeFileName(name: string): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex -- control characters are exactly what we strip
    .replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return cleaned === '' ? FALLBACK_NAME : cleaned;
}

/**
 * The file name for saving a deck: `<safe name>.sododeck`, or `<safe name>.sododeck.md` for the
 * Markdown form. A deck named after a file (`Shop.sododeck`, `Shop.sododeck.json`,
 * `Shop.sododeck.md`) is not given an extension twice.
 */
export function deckFileName(name: string, format: 'json' | 'markdown' = 'json'): string {
  const safe = safeFileName(name);
  const lower = safe.toLowerCase();
  const known = [DECK_MARKDOWN_EXTENSION, LEGACY_EXTENSION, DECK_EXTENSION].find((ext) =>
    lower.endsWith(ext),
  );
  const stem = known === undefined ? safe : safe.slice(0, -known.length);
  const extension = format === 'markdown' ? DECK_MARKDOWN_EXTENSION : DECK_EXTENSION;
  return `${stem.trim() === '' ? FALLBACK_NAME : stem}${extension}`;
}

/** Saves `text` as a local file through a temporary `<a download>` (no network, FR-041). */
export function downloadText(fileName: string, text: string, mime = 'application/json'): void {
  downloadBlob(fileName, new Blob([text], { type: mime }));
}

export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoked on the next task: some browsers start the download only after click() returns.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
