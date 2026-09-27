import { supportsBroadcastChannel } from '../lib/features';

/** The same-origin channel of one deck's open tabs (research R4). */
export function deckChannelName(deckId: string): string {
  return `sododeck:deck:${deckId}`;
}

/** Messages on a deck channel (contracts/storage-api.md "deck-channel"). */
export type DeckChannelMessage =
  | { t: 'update'; from: string; bytes: Uint8Array }
  | { t: 'hello'; from: string; sv: Uint8Array; reply: boolean }
  | { t: 'diff'; to: string; bytes: Uint8Array };

/**
 * Tells open editor tabs about a change made outside them (a library rename), so they show it at
 * once. Free of Yjs, so the library route can use it. No-op without BroadcastChannel: those tabs
 * catch up from storage on focus.
 */
export function postDeckUpdate(deckId: string, bytes: Uint8Array): void {
  if (!supportsBroadcastChannel()) return;
  const channel = new BroadcastChannel(deckChannelName(deckId));
  channel.postMessage({ t: 'update', from: 'library', bytes } satisfies DeckChannelMessage);
  channel.close();
}
