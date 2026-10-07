import type { HostMessage, EditorMessage } from '@sododeck/host-protocol';
import { assetId, inspectDeckText, MAX_ASSET_BYTES, sniffType } from '@sododeck/model';
import { checkPicturePath, PATH_VIOLATION_TEXT } from '@sododeck/schema';

import type { Loc, Ports } from './ports';
import { OUTSIDE_WORKSPACE, resolveInside } from './workspace-guard';

type PicturePut = Extract<EditorMessage, { type: 'picture-put' }>;
type PictureGet = Extract<EditorMessage, { type: 'picture-get' }>;
type Answer = Extract<
  HostMessage,
  { type: 'picture-stored' | 'picture-store-failed' | 'picture' | 'picture-missing' }
>;

const EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

export const NOT_TRUSTED = 'workspace not trusted';

/** `docs/arch.sododeck` and `docs/arch.sododeck.json` both give `arch`. */
export function deckBaseName(basename: string): string {
  return basename.replace(/\.sododeck(?:\.json)?$/i, '');
}

/** The folder name next to the deck that holds its picture files (068). */
export function assetsFolder(deckBasename: string): string {
  return `${deckBaseName(deckBasename)}.assets`;
}

function withSuffix(file: string, n: number): string {
  if (n === 1) return file;
  const dot = file.lastIndexOf('.');
  return `${file.slice(0, dot)}-${String(n)}${file.slice(dot)}`;
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

export type Stored = { ok: true; path: string } | { ok: false; reason: string };

/**
 * Stores picture bytes as `<deck base>.assets/<16 hex of id>.<ext>` next to the deck and returns
 * the path to write into the deck (R8). An identical existing file is reused, a different one is
 * never overwritten (`-2`, `-3`…). Used by `picture-put` and by Save As.
 */
export async function storePicture(
  deck: Loc,
  picture: { id: string; mime: string; bytes: Uint8Array },
  ports: Ports,
): Promise<Stored> {
  const { id, bytes } = picture;
  const fail = (reason: string): Stored => ({ ok: false, reason });
  const { files } = ports;

  if (!ports.trust.isTrusted()) return fail(NOT_TRUSTED);
  const ext = EXTENSION[picture.mime];
  if (ext === undefined) return fail('this picture type is not supported');
  if (bytes.length > MAX_ASSET_BYTES) return fail('the picture is larger than 5 MiB');
  if (assetId(bytes) !== id) return fail('the picture changed before it was stored');

  const folder = assetsFolder(files.basename(deck));
  const base = id.slice(0, 16);
  const violation = checkPicturePath(`${folder}/${base}.${ext}`);
  if (violation !== null) return fail(`The picture path ${PATH_VIOLATION_TEXT[violation]}`);

  const folderGuard = await resolveInside(deck, folder, ports);
  if (!folderGuard.ok) return fail(folderGuard.reason);

  try {
    for (let n = 1; n < 1000; n++) {
      const file = withSuffix(`${base}.${ext}`, n);
      const rel = `${folder}/${file}`;
      const guard = await resolveInside(deck, rel, ports);
      if (!guard.ok) return fail(guard.reason);
      if (await files.exists(guard.loc)) {
        if (same(await files.read(guard.loc), bytes)) return { ok: true, path: rel };
        continue;
      }
      await files.mkdir(folderGuard.loc);
      await files.write(guard.loc, bytes);
      return { ok: true, path: rel };
    }
    return fail('could not find a free file name');
  } catch (error) {
    return fail(`could not be written: ${reasonOf(error)}`);
  }
}

/**
 * Picture files next to the deck (R8, contracts §3): `picture-put` stores, `picture-get` serves.
 * Everything is judged on the real location (`resolveInside`) and nothing outside the workspace
 * is read or written; an existing file is never overwritten with other bytes.
 */
export class PictureHost {
  constructor(
    private readonly deckLoc: Loc | (() => Loc),
    /** The latest deck text, to find `assets[id].path` through the model. */
    private readonly deckText: () => string,
    private readonly ports: Ports,
  ) {}

  private get deck(): Loc {
    return typeof this.deckLoc === 'function' ? this.deckLoc() : this.deckLoc;
  }

  async put(message: PicturePut): Promise<Answer> {
    const { id } = message;
    const result = await storePicture(this.deck, message, this.ports);
    return result.ok
      ? { type: 'picture-stored', id, path: result.path }
      : { type: 'picture-store-failed', id, reason: result.reason };
  }

  async get(message: PictureGet): Promise<Answer> {
    const { id } = message;
    const missing = (reason: string): Answer => ({ type: 'picture-missing', id, reason });
    const { files } = this.ports;

    const inspected = inspectDeckText(this.deckText());
    if (!inspected.ok) return missing('could not be read');
    const ref = inspected.loaded.fileRefs.find((r) => r.id === id);
    if (ref === undefined) return missing('not found');
    if (!this.ports.trust.isTrusted()) return missing(NOT_TRUSTED);

    const guard = await resolveInside(this.deck, ref.path, this.ports);
    if (!guard.ok) return missing(guard.reason);

    let size: number;
    try {
      size = await files.size(guard.loc);
    } catch {
      return missing('not found');
    }
    if (size > MAX_ASSET_BYTES) return missing('could not be read');
    let bytes: Uint8Array;
    try {
      bytes = await files.read(guard.loc);
    } catch {
      return missing('could not be read');
    }
    if (assetId(bytes) !== id) return missing('the file changed');
    const mime = sniffType(bytes);
    if (mime === null) return missing('could not be read');
    return { type: 'picture', id, mime, bytes };
  }
}

export { OUTSIDE_WORKSPACE };
