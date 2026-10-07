import { inspectDeckText } from '@sododeck/model';

import { writeDeckFile } from './file-writer';
import { emptyDeckText } from './host-session';
import type { Loc, Ports } from './ports';

/** Where "Open in Sododeck web" sends the user's browser. Nothing is uploaded. */
export const WEB_APP_URL = 'https://app.sododeck.com';

const DECK_NAME = /\.sododeck(?:\.json)?$/i;

/**
 * "New Sododeck deck": asks where, never overwrites, writes the model's empty deck and opens it.
 * `folder` is the explorer folder the command was run on, if any.
 */
export async function newDeck(ports: Ports, folder?: Loc): Promise<void> {
  const start = folder ?? ports.workspace.folders()[0];
  const chosen = await ports.ui.showSaveDialog('untitled.sododeck', start);
  if (chosen === undefined) return;
  const target = DECK_NAME.test(chosen) ? chosen : `${chosen}.sododeck`;
  // The dialog usually asks about overwriting; check again, so a file is never replaced here.
  if (await ports.files.exists(target)) {
    ports.ui.warn(`${ports.files.basename(target)} already exists. Choose another name.`);
    return;
  }
  const text = emptyDeckText();
  if (!inspectDeckText(text).ok) {
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
