/**
 * Link input for the inspector's LINKS field (008 research R6, FR-006, FR-038). Only http, https
 * and relative links are kept, so a stored link can never run script when it is opened.
 */
import type { Link } from '@sododeck/schema';

export const LINK_REFUSED = 'Only http, https or relative links';

export type LinkInput =
  | { ok: true; link: Required<Link> }
  | { ok: false; /** null: nothing typed (no message). */ error: string | null };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function lastSegment(path: string): string {
  const clean = path.replace(/[?#].*$/, '').replace(/\/+$/, '');
  return (
    clean
      .split('/')
      .filter((s) => s !== '' && s !== '.' && s !== '..')
      .at(-1) ?? path
  );
}

export function parseLinkInput(text: string): LinkInput {
  const url = text.trim();
  if (url === '') return { ok: false, error: null };
  if (url.startsWith('//')) return { ok: false, error: LINK_REFUSED };
  if (!SCHEME.test(url)) return { ok: true, link: { url, label: lastSegment(url) } };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: LINK_REFUSED };
  }
  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.hostname === '') {
    return { ok: false, error: LINK_REFUSED };
  }
  return { ok: true, link: { url, label: parsed.hostname.replace(/^www\./, '') } };
}

/** Opens a stored link in a new tab, only on user activation; relative links use the app origin. */
export function openLink(url: string): void {
  const result = parseLinkInput(url);
  if (!result.ok) return;
  window.open(new URL(url, window.location.origin).href, '_blank', 'noopener,noreferrer');
}
