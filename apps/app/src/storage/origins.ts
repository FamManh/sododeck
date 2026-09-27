/**
 * Yjs transaction origins of the storage providers. Updates with these origins came from
 * storage or another tab: they are never written again, never relayed again, and never tracked
 * by the editor's undo history (which tracks only the editor's own origin).
 */
export const storageOrigin: object = Object.freeze({ provider: 'sododeck-storage' });
export const channelOrigin: object = Object.freeze({ provider: 'sododeck-channel' });

/** True for updates that this tab must persist and relay: its own edits, undo and redo. */
export function isOwnUpdate(origin: unknown): boolean {
  return origin !== storageOrigin && origin !== channelOrigin;
}
