/**
 * "New Sododeck" (070 R11, US6): the pure part creates the file; the glue in `main.ts` wires
 * the palette command and the folder menu to it.
 */
import { emptyDeckText } from '@sododeck/model';

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
