const FALLBACK_NAME = 'Untitled deck';
const MAX_NAME_LENGTH = 100;

/**
 * A deck name made safe for a download file name (research R14): characters that file systems
 * refuse (`/\:*?"<>|`) and control characters become `-`, runs of spaces collapse, and the result
 * is trimmed to 100 characters. The caller adds `.sododeck.json`.
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

/** Saves `text` as a local file through a temporary `<a download>` (no network, FR-041). */
export function downloadText(fileName: string, text: string, mime = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
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
