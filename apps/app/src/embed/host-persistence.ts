import { applyDeckText, serializeDeck, type ApplyResult, type DeckDoc } from '@sododeck/model';

import { isOwnUpdate } from '../storage/origins';
import { hostOrigin } from './host-origin';

/** How long after the first edit of a burst the file goes to the host (067 R4). */
const FLUSH_MS = 100;
/** How long the host has to answer a `change` before the editor says it was not taken (R11). */
const ACK_TIMEOUT_MS = 5000;
/** Sent texts kept for the echo check (R5). */
const RECENT_SENT = 8;

const NOT_TAKEN = 'The program hosting this editor did not take the last change.';
const REFUSED = 'The program hosting this editor refused the last change.';

/** The message the editor sends for an edit: the whole canonical file (contracts/host-protocol.md). */
export interface ChangeMessage {
  type: 'change';
  seq: number;
  text: string;
}

export interface HostPersistenceOptions {
  flushMs?: number;
  ackTimeoutMs?: number;
  /** Picture bytes to embed in the file, read when a send starts (so pictures are never lost). */
  pictureBytes?: (doc: DeckDoc) => Promise<Map<string, Uint8Array>>;
  /** The host's answer is an error (or none came): show it. `null` clears it. */
  onError: (reason: string | null) => void;
}

export interface HostPersistence {
  /** Sends a pending change now; resolves when it has been handed to the transport. */
  flush(): Promise<void>;
  /** Merges a file the host changed; `'echo'` for a text this editor sent itself. */
  applyExternal(text: string): ApplyResult | 'echo';
  /** The host's answer to a `change`. */
  handleResult(result: { seq: number; ok: boolean; reason?: string | undefined }): void;
  /** While blocked (an invalid file is shown) nothing is sent and pending edits are dropped. */
  setBlocked(blocked: boolean): void;
  destroy(): void;
}

/**
 * Hands the deck to the host as it is edited (067 R4): the first own edit of a burst arms one
 * timer; when it fires the whole deck is serialised and sent. A burst is one message, and each
 * message is the latest complete state, so skipping intermediate states is safe. Updates from
 * storage or the host itself (`isOwnUpdate`) are never sent back (R5).
 */
export function attachHostPersistence(
  doc: DeckDoc,
  send: (message: ChangeMessage) => void,
  options: HostPersistenceOptions,
): HostPersistence {
  const flushMs = options.flushMs ?? FLUSH_MS;
  const ackTimeoutMs = options.ackTimeoutMs ?? ACK_TIMEOUT_MS;

  let dirty = false;
  let blocked = false;
  let destroyed = false;
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<void> = Promise.resolve();
  let recentSent: string[] = [];
  const awaiting = new Map<number, ReturnType<typeof setTimeout>>();

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  /** Nothing to send, or sending is off. A function, so it is read afresh after each await. */
  const idle = () => !dirty || blocked || destroyed;

  const sendNow = async () => {
    if (idle()) return;
    const bytes = options.pictureBytes === undefined ? undefined : await options.pictureBytes(doc);
    // The state may have changed while the bytes were read: serialise now, and the burst that
    // follows arms its own timer.
    if (idle()) return;
    dirty = false;
    clearTimer();
    const text = serializeDeck(doc, bytes);
    seq += 1;
    const current = seq;
    recentSent = [...recentSent, text].slice(-RECENT_SENT);
    awaiting.set(
      current,
      setTimeout(() => {
        awaiting.delete(current);
        options.onError(NOT_TAKEN);
      }, ackTimeoutMs),
    );
    send({ type: 'change', seq: current, text });
  };

  const sendPending = () => {
    chain = chain.then(sendNow);
    return chain;
  };

  const onUpdate = (_update: Uint8Array, origin: unknown) => {
    if (!isOwnUpdate(origin) || blocked) return;
    dirty = true;
    timer ??= setTimeout(() => {
      timer = undefined;
      void sendPending();
    }, flushMs);
  };
  doc.on('update', onUpdate);

  return {
    flush() {
      clearTimer();
      return sendPending();
    },
    applyExternal(text) {
      if (recentSent.includes(text)) return 'echo';
      const result = applyDeckText(doc, text, hostOrigin);
      // Anything sent before this outside file is older than it: not an echo any more.
      if (result.status === 'applied' && result.changed) recentSent = [];
      return result;
    },
    handleResult({ seq: answered, ok, reason }) {
      // An answer to a later change settles the earlier ones too.
      for (const [pending, handle] of awaiting) {
        if (pending > answered) continue;
        clearTimeout(handle);
        awaiting.delete(pending);
      }
      options.onError(ok ? null : (reason ?? REFUSED));
    },
    setBlocked(next) {
      blocked = next;
      if (next) {
        dirty = false;
        clearTimer();
      }
    },
    destroy() {
      destroyed = true;
      doc.off('update', onUpdate);
      clearTimer();
      for (const handle of awaiting.values()) clearTimeout(handle);
      awaiting.clear();
    },
  };
}
