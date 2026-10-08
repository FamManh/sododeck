/**
 * Pictures for a deck note (070 contracts/obsidian-host.md, "Pictures"): `picture-put` stores a
 * new picture as a vault file where the user's own attachment settings say, and answers with the
 * link text the app tracks; `picture-get` serves a picture from the link in the deck. Pure over
 * `VaultFilePort`; nothing outside the vault is ever read or written.
 */
import type { EditorMessage, HostMessage } from '@sododeck/host-protocol';
import { assetId, MAX_ASSET_BYTES, sniffType } from '@sododeck/model';
import { checkPicturePath, PATH_VIOLATION_TEXT } from '@sododeck/schema';

import type { FileKind } from './file-codec';
import type { Ports, VaultEvent } from './ports';
import { basename, dirname, joinInVault } from './vault-guard';

type PicturePut = Extract<EditorMessage, { type: 'picture-put' }>;
type PictureGet = Extract<EditorMessage, { type: 'picture-get' }>;
export type PictureAnswer = Extract<
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

export const NOT_STORED_HERE = 'this deck keeps its pictures inside the file';

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Picture ids are the SHA-256 of the bytes; the model's `assetId` is the synchronous twin. */
function idOf(bytes: Uint8Array): string {
  return assetId(bytes);
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

export interface DeckRef {
  /** A function: the deck can be renamed while the view is open. */
  path: () => string;
  kind: FileKind;
  /** The deck text the canvas holds (read for `assets[id].path`). */
  deckText: () => string;
}

export class PictureHost {
  /** Pictures reported missing: id → the link as written, retried when the vault changes (FR-026). */
  private readonly pending = new Map<string, string>();

  constructor(
    private readonly deck: DeckRef,
    private readonly ports: Ports,
  ) {}

  get pendingIds(): readonly string[] {
    return [...this.pending.keys()];
  }

  async put(message: PicturePut, allowed: boolean): Promise<PictureAnswer> {
    const { id, bytes } = message;
    const fail = (reason: string): PictureAnswer => ({ type: 'picture-store-failed', id, reason });
    if (!allowed) return fail(NOT_STORED_HERE);
    const ext = EXTENSION[message.mime];
    if (ext === undefined) return fail('this picture type is not supported');
    if (bytes.length > MAX_ASSET_BYTES) return fail('the picture is larger than 5 MiB');
    if (idOf(bytes) !== id) return fail('the picture changed before it was stored');
    const name = `${id.slice(0, 16)}.${ext}`;
    const { files } = this.ports;
    try {
      const target = await files.availablePath(name, this.deck.path());
      let file = target;
      if (basename(target) !== name) {
        // The wanted name is taken in the folder the settings choose: the same picture is reused,
        // another file with that name is never touched (the app's de-duplicated name is used).
        const folder = dirname(target);
        const taken = folder === '' ? name : `${folder}/${name}`;
        if (files.exists(taken)) {
          const existing = await files.readBinary(taken);
          if ((await sha256Hex(existing)) === id) file = taken;
        }
      }
      if (file === target) await files.createBinary(target, bytes);
      const link = files.linkTextFor(file, this.deck.path());
      const violation = checkPicturePath(link);
      if (violation !== null) return fail(`the link ${PATH_VIOLATION_TEXT[violation]}`);
      return { type: 'picture-stored', id, path: link };
    } catch (error) {
      return fail(`it could not be written: ${reasonOf(error)}`);
    }
  }

  /** The path of `id` as written in the deck, or undefined. */
  private pathOf(id: string): string | undefined {
    try {
      const parsed: unknown = JSON.parse(this.deck.deckText());
      const assets = (parsed as { assets?: Record<string, { path?: unknown }> }).assets;
      const path = assets?.[id]?.path;
      return typeof path === 'string' ? path : undefined;
    } catch {
      return undefined;
    }
  }

  async get(message: PictureGet): Promise<PictureAnswer> {
    const { id } = message;
    const missing = (reason: string, retry: boolean, path?: string): PictureAnswer => {
      if (retry && path !== undefined) this.pending.set(id, path);
      else this.pending.delete(id);
      return { type: 'picture-missing', id, reason };
    };
    const path = this.pathOf(id);
    if (path === undefined) return missing('not found', false);

    const joined = joinInVault(dirname(this.deck.path()), path);
    if (!joined.ok) return missing(joined.reason, false);

    const { files } = this.ports;
    const resolved =
      this.deck.kind === 'markdown'
        ? files.resolveLink(path, this.deck.path())
        : files.exists(joined.path)
          ? joined.path
          : null;
    if (resolved === null) return missing(`not found: ${path}`, true, path);

    let bytes: Uint8Array;
    try {
      bytes = await files.readBinary(resolved);
    } catch {
      return missing(`could not be read: ${path}`, true, path);
    }
    if (bytes.length > MAX_ASSET_BYTES) return missing('the file is larger than 5 MiB', false);
    if (idOf(bytes) !== id) return missing('the file changed', false);
    const mime = sniffType(bytes);
    if (mime === null) return missing('the file is not a supported picture', false);
    this.pending.delete(id);
    return { type: 'picture', id, mime, bytes };
  }

  /**
   * A vault change that might make a missing picture resolvable (a file created, moved or
   * edited): answers for each pending id that now resolves. Only events for a path that could
   * match (same file name as the missing link, or the link itself) cause a read.
   */
  async retry(event: VaultEvent): Promise<PictureAnswer[]> {
    const answers: PictureAnswer[] = [];
    if (event.kind === 'delete') return answers;
    for (const [id, link] of [...this.pending]) {
      const couldMatch =
        basename(event.path) === basename(link) ||
        event.path === link ||
        event.path.endsWith(`/${link}`);
      if (!couldMatch) continue;
      const answer = await this.get({ type: 'picture-get', id });
      if (answer.type === 'picture') answers.push(answer);
    }
    return answers;
  }
}
