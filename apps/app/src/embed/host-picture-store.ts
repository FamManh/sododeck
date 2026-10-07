import type { Capabilities, EditorMessage, HostMessage } from '@sododeck/host-protocol';

import type { PictureStore, StoredPicture } from '../images/picture-store';

/** How long a `picture-get` may stay unanswered before the picture counts as missing (R7). */
const GET_TIMEOUT_MS = 10_000;
const NO_ANSWER = 'The program hosting this editor did not answer.';

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export interface HostPictureStore extends PictureStore {
  /** Pictures saved as files next to the deck (068) are asked for by id, not shown as missing. */
  readonly readsFilePaths: true;
  /**
   * Keeps bytes a deck file carried (`init`, `external-change`) in memory, with nothing sent: the
   * file already holds them, and opening a deck never moves its pictures out.
   */
  remember(id: string, picture: StoredPicture): void;
  /** The host's answers to `picture-put` and `picture-get`. */
  receive(message: HostMessage): void;
  /** Why the host could not give a picture (its own words, or that it did not answer). */
  missingReason(id: string): string | undefined;
}

export interface HostPictureHandlers {
  /** The pictures ability is on, now (a later `init` may change it). */
  isOn: () => Capabilities['pictures'];
  /** The host stored a picture at `path`: the editor writes it into the file. */
  onStored: (id: string, path: string) => void;
  /** The host did not store it: the picture stays embedded in the file. */
  onFailed: (id: string, reason: string) => void;
  getTimeoutMs?: number;
}

/**
 * The embed's `PictureStore` (067 R7). Bytes live in memory, like the in-memory store. With the
 * pictures ability a new picture is also handed to the host (`picture-put`) and one the deck names
 * but the editor lacks is fetched (`picture-get`); without it nothing is sent, and the file embeds
 * the bytes. `getBytes` is memory only: the file never needs bytes of a picture stored as a file.
 */
export function hostPictureStore(
  send: (message: EditorMessage) => void,
  handlers: HostPictureHandlers,
): HostPictureStore {
  const rows = new Map<string, StoredPicture>();
  const sent = new Set<string>();
  const pending = new Map<string, Promise<Blob | null>>();
  const waiting = new Map<string, (blob: Blob | null) => void>();
  const missing = new Map<string, string>();
  const timeout = handlers.getTimeoutMs ?? GET_TIMEOUT_MS;
  const key = `host:${crypto.randomUUID()}`;

  const blobOf = (row: StoredPicture) =>
    new Blob([row.bytes as Uint8Array<ArrayBuffer>], { type: row.type });

  const settle = (id: string, blob: Blob | null) => {
    waiting.get(id)?.(blob);
  };

  return {
    key,
    readsFilePaths: true,
    put(id, picture) {
      if (!rows.has(id)) rows.set(id, picture);
      if (handlers.isOn() && !sent.has(id)) {
        sent.add(id);
        const extension = EXTENSIONS[picture.type] ?? 'bin';
        send({
          type: 'picture-put',
          id,
          mime: picture.type,
          name: picture.name ?? `${id.slice(0, 8)}.${extension}`,
          bytes: picture.bytes,
        });
      }
      return Promise.resolve();
    },
    get(id) {
      const row = rows.get(id);
      if (row !== undefined) return Promise.resolve(blobOf(row));
      if (!handlers.isOn()) return Promise.resolve(null);
      const asked = pending.get(id);
      if (asked !== undefined) return asked;
      const promise = new Promise<Blob | null>((resolve) => {
        const timer = setTimeout(() => {
          missing.set(id, NO_ANSWER);
          settle(id, null);
        }, timeout);
        waiting.set(id, (blob) => {
          clearTimeout(timer);
          waiting.delete(id);
          pending.delete(id);
          resolve(blob);
        });
      });
      pending.set(id, promise);
      send({ type: 'picture-get', id });
      return promise;
    },
    getBytes: (id) => Promise.resolve(rows.get(id) ?? null),
    ids: () => Promise.resolve([...rows.keys()]),
    missingReason: (id) => missing.get(id),
    remember(id, picture) {
      if (!rows.has(id)) rows.set(id, picture);
      sent.add(id);
    },
    receive(message) {
      switch (message.type) {
        case 'picture-stored':
          handlers.onStored(message.id, message.path);
          return;
        case 'picture-store-failed':
          handlers.onFailed(message.id, message.reason);
          return;
        case 'picture': {
          const row: StoredPicture = { type: message.mime, bytes: message.bytes };
          rows.set(message.id, row);
          missing.delete(message.id);
          settle(message.id, blobOf(row));
          return;
        }
        case 'picture-missing':
          missing.set(message.id, message.reason);
          settle(message.id, null);
          return;
        default:
          return;
      }
    },
  };
}
