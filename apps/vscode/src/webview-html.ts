/**
 * Builds the page a webview shows (R4, R5): the embed build's `embed.html` with every file URL
 * pointed at the extension's own files, a strict content policy and the shim loaded first. Pure:
 * the URI mapper, the policy source and the nonce come from the caller.
 */

export interface PageInput {
  /** Text of `media/embed/embed.html`. */
  embedHtml: string;
  /** Maps a path relative to the embed folder (`assets/x.js`) to a webview URI. */
  toWebviewUri: (relative: string) => string;
  /** URI of `media/webview-shim.js`. */
  shimUri: string;
  /** `webview.cspSource`. */
  cspSource: string;
  nonce: string;
}

/** Only the extension's own files, blob workers, no remote source of any kind (FR-024). */
export function contentSecurityPolicy(cspSource: string, nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' ${cspSource}`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `img-src ${cspSource} data: blob:`,
    `font-src ${cspSource}`,
    `connect-src ${cspSource} blob: data:`,
    'worker-src blob:',
  ].join('; ');
}

/** A fresh, unguessable nonce; 128 random bits as hex. */
export function makeNonce(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function relativeOf(url: string): string | null {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i.test(url)) return null;
  return url.replace(/^\.\//, '');
}

export function buildWebviewPage(input: PageInput): string {
  const { embedHtml, toWebviewUri, shimUri, cspSource, nonce } = input;
  let html = embedHtml.replace(
    /\b(src|href)="([^"]*)"/g,
    (whole: string, attribute: string, url: string) => {
      const rel = relativeOf(url);
      return rel === null ? whole : `${attribute}="${toWebviewUri(rel)}"`;
    },
  );
  html = html.replace(/<script\b/g, `<script nonce="${nonce}"`);
  const head =
    `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(cspSource, nonce)}">` +
    `<script nonce="${nonce}" src="${shimUri}"></script>`;
  return html.replace(/<head>/i, `<head>${head}`);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => `&#${String(c.charCodeAt(0))};`);
}

/** A plain page with one message and no script, e.g. for a deck that is already open (FR-027). */
export function messagePage(message: string, cspSource: string): string {
  return (
    `<!doctype html><html lang="en"><head><meta charset="UTF-8">` +
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${cspSource}">` +
    `<style>body{font:13px var(--vscode-font-family,sans-serif);color:var(--vscode-foreground);padding:2em}</style>` +
    `</head><body><p>${escapeHtml(message)}</p></body></html>`
  );
}
