import { emptyDeckText as modelEmptyDeckText, inspectDeckText, toMarkdown } from '@sododeck/model';

import { writeDeckFile } from './file-writer';
import { emptyDeckText } from './host-session';
import type { Loc, Ports } from './ports';

/** Where "Open in Sododeck web" sends the user's browser. Nothing is uploaded. */
export const WEB_APP_URL = 'https://app.sododeck.com';

const DECK_NAME = /\.sododeck(?:\.json)?$/i;

const NOTE_NAME = /\.sododeck\.md$/i;

/**
 * "New Sododeck": asks where, never overwrites, writes the model's empty deck and opens it.
 * `folder` is the explorer folder the command was run on, if any.
 */
export async function newDeck(ports: Ports, folder?: Loc): Promise<void> {
  await createFile(ports, folder, 'untitled.sododeck', DECK_NAME, '.sododeck', emptyDeckText());
}

/** "New Sododeck note": the same, for a `.sododeck.md` note of the empty deck (FR-013). */
export async function newNote(ports: Ports, folder?: Loc): Promise<void> {
  await createFile(
    ports,
    folder,
    'untitled.sododeck.md',
    NOTE_NAME,
    '.sododeck.md',
    toMarkdown(modelEmptyDeckText()),
  );
}

async function createFile(
  ports: Ports,
  folder: Loc | undefined,
  suggested: string,
  hasExtension: RegExp,
  extension: string,
  text: string,
): Promise<void> {
  const start = folder ?? ports.workspace.folders()[0];
  const chosen = await ports.ui.showSaveDialog(suggested, start);
  if (chosen === undefined) return;
  const target = hasExtension.test(chosen) ? chosen : `${chosen}${extension}`;
  // The dialog usually asks about overwriting; check again, so a file is never replaced here.
  if (await ports.files.exists(target)) {
    ports.ui.warn(`${ports.files.basename(target)} already exists. Choose another name.`);
    return;
  }
  if (!inspectDeckText(emptyDeckText()).ok) {
    ports.ui.warn('Sododeck could not create an empty deck.');
    return;
  }
  try {
    await ports.files.mkdir(ports.files.dirname(target));
    await writeDeckFile(ports.files, target, text);
  } catch (error) {
    ports.ui.warn(error instanceof Error ? error.message : 'Could not create the deck.');
    return;
  }
  await ports.ui.openUri(target);
}

/**
 * "Copy as .sododeck" (US2): writes `<name>.sododeck` next to a `.sododeck.json` with the same
 * text. Never overwrites (a taken name gets ` 1`, ` 2`…); the original is untouched.
 */
export async function copyAsSododeck(ports: Ports, source: Loc): Promise<void> {
  const { files, ui } = ports;
  const name = files.basename(source);
  let text: string;
  try {
    text = new TextDecoder().decode(await files.read(source));
  } catch (error) {
    ui.warn(`Could not read ${name}: ${error instanceof Error ? error.message : 'unknown error'}`);
    return;
  }
  if (!inspectDeckText(text).ok) {
    ui.warn(`${name} is not a Sododeck deck.`);
    return;
  }
  const folder = files.dirname(source);
  const base = name.replace(/\.sododeck\.json$/i, '').replace(/\.json$/i, '');
  let target = files.join(folder, `${base}.sododeck`);
  for (let n = 1; await files.exists(target); n++) {
    if (n >= 10_000) {
      ui.warn(`No free name for ${base}.sododeck.`);
      return;
    }
    target = files.join(folder, `${base} ${String(n)}.sododeck`);
  }
  try {
    await writeDeckFile(files, target, text);
  } catch (error) {
    ui.warn(error instanceof Error ? error.message : 'Could not write the deck.');
    return;
  }
  await ui.openUri(target);
}

/**
 * "Open in Sododeck web": shows the file in the file manager and opens the web app in the
 * browser; the user drags the file in. Reads nothing from the deck and sends nothing.
 */
export async function openInWeb(ports: Ports, deck: Loc | undefined): Promise<void> {
  if (deck === undefined) {
    ports.ui.notify('Open a Sododeck deck first, then run this command.');
    return;
  }
  await ports.ui.revealInOs(deck);
  await ports.ui.openExternal(WEB_APP_URL);
}
