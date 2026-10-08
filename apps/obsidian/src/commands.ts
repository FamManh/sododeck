/**
 * "New Sododeck" (070 R11, US6): the pure part creates the file; the glue in `main.ts` wires
 * the palette command and the folder menu to it.
 */
import { emptyDeckText, inspectDeckText } from '@sododeck/model';

export interface NewDeckVault {
  exists(path: string): boolean;
  /** Creates a new text file; rejects when the path is taken. */
  createText(path: string, text: string): Promise<void>;
}

const EXTENSION = '.sododeck';

/**
 * `Sodo deck <date> <hh-mm>.sododeck` (the ISO time to the minute, `T` as a space and the colon
 * as `-`: a colon is not allowed in a file name on every system), so names sort by creation time. A name
 * that is somehow taken gets ` 1`, ` 2`…, never overwritten.
 */
export function newDeckPath(
  folder: string,
  taken: (path: string) => boolean,
  now: Date = new Date(),
): string {
  const stamp = now.toISOString().slice(0, 16).replace('T', ' ').replace(':', '-');
  const at = (name: string): string => (folder === '' ? name : `${folder}/${name}`);
  for (let n = 0; n < 10_000; n++) {
    const path = at(`Sodo deck ${stamp}${n === 0 ? '' : ` ${String(n)}`}${EXTENSION}`);
    if (!taken(path)) return path;
  }
  throw new Error('No free name for a new deck.');
}

/** An empty deck as a plain `.sododeck` file: valid, and not rewritten until the first edit. */
export function newDeckText(): string {
  return emptyDeckText();
}

/** Creates the file and returns its path. Never overwrites. */
export async function createNewDeck(
  vault: NewDeckVault,
  folder: string,
  now: Date = new Date(),
): Promise<string> {
  const path = newDeckPath(folder, (p) => vault.exists(p), now);
  await vault.createText(path, newDeckText());
  return path;
}

export interface CopyVault extends NewDeckVault {
  readText(path: string): Promise<string>;
}

export type CopyResult = { ok: true; path: string } | { ok: false; reason: string };

const JSON_SUFFIX = /\.sododeck\.json$/i;

/** Vault paths of older-form decks; Obsidian does not list `.json` files, so the picker needs this. */
export function deckJsonFiles(paths: readonly string[]): string[] {
  return paths.filter((p) => JSON_SUFFIX.test(p));
}

/**
 * Copies a `.sododeck.json` to `<name>.sododeck` next to it (071 R6): same text, original
 * untouched, never overwriting (a taken name gets ` 1`, ` 2`…).
 */
export async function copyAsSododeck(vault: CopyVault, source: string): Promise<CopyResult> {
  let text: string;
  try {
    text = await vault.readText(source);
  } catch (error) {
    return { ok: false, reason: `could not read: ${errorMessage(error)}` };
  }
  if (!inspectDeckText(text).ok) return { ok: false, reason: 'not a Sododeck deck' };
  const base = source.replace(JSON_SUFFIX, '');
  let target = `${base}${EXTENSION}`;
  for (let n = 1; vault.exists(target); n++) {
    if (n >= 10_000) return { ok: false, reason: 'no free name' };
    target = `${base} ${String(n)}${EXTENSION}`;
  }
  try {
    await vault.createText(target, text);
  } catch (error) {
    return { ok: false, reason: `could not write: ${errorMessage(error)}` };
  }
  return { ok: true, path: target };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
