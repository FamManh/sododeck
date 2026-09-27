import type { DeckDoc } from '@sododeck/model';
import * as Y from 'yjs';

import { supportsBroadcastChannel } from '../lib/features';
import { deckChannelName, type DeckChannelMessage } from './deck-channel-post';
import type { DeckPersistence } from './deck-persistence';
import { channelOrigin, isOwnUpdate } from './origins';

export { channelOrigin };

export interface DeckChannel {
  /** Relays an update to the other tabs (used for changes this tab did not make itself). */
  post(bytes: Uint8Array): void;
  destroy(): void;
}

/**
 * Live multi-tab sync for one deck (research R4, ADR 0007). Local updates go to the other tabs
 * of the deck; theirs are applied with `channelOrigin`, so they are neither relayed again, nor
 * stored again (their sender stores them), nor undoable here (undo stays per tab). A `hello` /
 * `diff` state-vector exchange on open brings in edits other tabs have not stored yet. On focus
 * the tab also reads rows it has not seen from storage: messages missed while it was frozen, or
 * the whole mechanism where BroadcastChannel is missing.
 */
export function attachDeckChannel(
  deckId: string,
  doc: DeckDoc,
  {
    persistence,
    tabId = crypto.randomUUID(),
  }: { persistence: Pick<DeckPersistence, 'catchUp'>; tabId?: string },
): DeckChannel {
  const catchUp = () => {
    void persistence.catchUp();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') catchUp();
  };
  window.addEventListener('focus', catchUp);
  document.addEventListener('visibilitychange', onVisibility);
  const stopCatchUp = () => {
    window.removeEventListener('focus', catchUp);
    document.removeEventListener('visibilitychange', onVisibility);
  };

  if (!supportsBroadcastChannel()) return { post: () => undefined, destroy: stopCatchUp };

  const channel = new BroadcastChannel(deckChannelName(deckId));
  const send = (message: DeckChannelMessage) => {
    channel.postMessage(message);
  };
  const apply = (bytes: Uint8Array) => {
    Y.applyUpdate(doc, bytes, channelOrigin);
  };

  channel.onmessage = (event: MessageEvent<DeckChannelMessage>) => {
    const message = event.data;
    switch (message.t) {
      case 'update':
        if (message.from !== tabId) apply(message.bytes);
        return;
      case 'hello':
        if (message.from === tabId) return;
        send({ t: 'diff', to: message.from, bytes: Y.encodeStateAsUpdate(doc, message.sv) });
        // Answer once, so the newcomer sends us what we are missing too.
        if (!message.reply) {
          send({ t: 'hello', from: tabId, sv: Y.encodeStateVector(doc), reply: true });
        }
        return;
      case 'diff':
        if (message.to === tabId) apply(message.bytes);
        return;
    }
  };

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (isOwnUpdate(origin)) send({ t: 'update', from: tabId, bytes: update });
  };
  doc.on('update', onUpdate);
  send({ t: 'hello', from: tabId, sv: Y.encodeStateVector(doc), reply: false });

  return {
    post: (bytes) => {
      send({ t: 'update', from: tabId, bytes });
    },
    destroy: () => {
      stopCatchUp();
      doc.off('update', onUpdate);
      channel.close();
    },
  };
}
