import type { EditorMessage } from '@sododeck/host-protocol';

import type { Loc, Ports } from './ports';
import { resolveInside } from './workspace-guard';

type OpenLink = Extract<EditorMessage, { type: 'open-link' }>;
type ExportFile = Extract<EditorMessage, { type: 'export-file' }>;

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** The relative part of a link, without query or fragment, percent-decoded; null if unusable. */
function relativePart(href: string): string | null {
  if (href.startsWith('//') || href.startsWith('#')) return null;
  const clean = href.replace(/[?#].*$/, '');
  try {
    return decodeURIComponent(clean);
  } catch {
    return null;
  }
}

/**
 * `open-link`: web links go to the user's browser (the extension makes no request itself); a
 * relative link opens a file inside the workspace and nothing else (FR-019 applies to links too).
 */
export async function handleOpenLink(
  message: OpenLink,
  deck: Loc,
  untitled: boolean,
  ports: Ports,
): Promise<void> {
  const { href } = message;
  if (/^https?:\/\//i.test(href)) {
    await ports.ui.openExternal(href);
    return;
  }
  if (HAS_SCHEME.test(href)) {
    ports.ui.notify('This link was not opened: only web links and files in the workspace open.');
    return;
  }
  const rel = relativePart(href);
  if (rel === null) return;
  if (untitled) {
    ports.ui.notify('Save the deck first, then relative links can open.');
    return;
  }
  const resolved = await resolveInside(deck, rel, ports, { kind: 'link' });
  if (!resolved.ok) {
    ports.ui.notify(`This link was not opened: ${resolved.reason}.`);
    return;
  }
  await ports.ui.openUri(resolved.loc);
}

/** `export-file`: the user picks where the file goes; cancel writes nothing. */
export async function handleExportFile(
  message: ExportFile,
  deck: Loc,
  untitled: boolean,
  ports: Ports,
): Promise<void> {
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is removed
  const name = message.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-') || 'export';
  const folder = untitled ? undefined : ports.files.dirname(deck);
  const target = await ports.ui.showSaveDialog(name, folder);
  if (target === undefined) return;
  try {
    await ports.files.write(target, message.bytes);
    ports.ui.statusMessage(`Saved ${ports.files.basename(target)}`);
  } catch (error) {
    ports.ui.warn(
      `Could not save ${name}: ${error instanceof Error ? error.message : 'unknown error'}.`,
    );
  }
}
