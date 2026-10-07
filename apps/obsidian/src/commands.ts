/**
 * "New Sododeck deck" (070 R11, US6): the pure part creates the file; the glue in `main.ts` wires
 * the palette command and the folder menu to it.
 */
import { emptyDeckText, toMarkdown } from '@sododeck/model';

export interface NewDeckVault {
  exists(path: string): boolean;
  /** Creates a new text file; rejects when the path is taken. */
  createText(path: string, text: string): Promise<void>;
}

const BASE = 'Untitled deck';
const EXTENSION = '.sododeck.md';

/** `<folder>/Untitled deck.sododeck.md`, numbered `Untitled deck 1…` while the name is taken. */
export function newDeckPath(folder: string, taken: (path: string) => boolean): string {
  const at = (name: string): string => (folder === '' ? name : `${folder}/${name}`);
  for (let n = 0; n < 10_000; n++) {
    const path = at(n === 0 ? `${BASE}${EXTENSION}` : `${BASE} ${String(n)}${EXTENSION}`);
    if (!taken(path)) return path;
  }
  throw new Error('No free name for a new deck.');
}

/** A valid, empty deck note: it opens as a deck and is not rewritten until the first edit. */
export function newDeckText(): string {
  return toMarkdown(emptyDeckText());
}

/** Creates the file and returns its path. Never overwrites. */
export async function createNewDeck(vault: NewDeckVault, folder: string): Promise<string> {
  const path = newDeckPath(folder, (p) => vault.exists(p));
  await vault.createText(path, newDeckText());
  return path;
}
