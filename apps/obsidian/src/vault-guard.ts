/**
 * Keeps picture paths inside the vault (070 R8, FR-027). Pure. `checkPicturePath` (schema) already
 * refuses `\`, `:`, a leading `/` and inner `..`; this adds the part only the host knows: where the
 * leading `..` segments end up, judged against the vault root.
 */
import { checkPicturePath, PATH_VIOLATION_TEXT, type PathViolation } from '@sododeck/schema';

export type Joined = { ok: true; path: string } | { ok: false; reason: string };

export const OUTSIDE_VAULT = 'it points outside the vault';

export function reasonText(violation: PathViolation): string {
  return `the path ${PATH_VIOLATION_TEXT[violation]}`;
}

/**
 * `rel` (as written in a deck, relative to the deck's folder) joined to `folder` (a vault folder,
 * `''` for the root). Refuses what leaves the vault, with a reason in plain words.
 */
export function joinInVault(folder: string, rel: string): Joined {
  const violation = checkPicturePath(rel);
  if (violation !== null) return { ok: false, reason: reasonText(violation) };
  const parts = folder === '' ? [] : folder.split('/');
  for (const segment of rel.split('/')) {
    if (segment === '..') {
      if (parts.length === 0) return { ok: false, reason: OUTSIDE_VAULT };
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return { ok: true, path: parts.join('/') };
}

export function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
