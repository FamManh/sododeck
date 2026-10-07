import {
  PROTOCOL_VERSION,
  type EditorMessage,
  type HostMessage,
  type Transport,
} from '@sododeck/host-protocol';
import { applyDeckText, createDeck, type ApplyResult, type DeckDoc } from '@sododeck/model';

import { APP_VERSION } from '../lib/app-version';
import { setThemeFromHost } from '../theme/theme-store';
import { useEmbedStore } from './embed-store';
import { readDeck } from '../model/use-deck-snapshot';
import { createEmbedPictures, type EmbedPictures } from './embed-pictures';
import { hostOrigin } from './host-origin';
import type { HostPersistence } from './host-persistence';

/** How long the editor waits for `init` before it says so (067 R12). */
const WAIT_MS = 10_000;

export interface EmbedSessionOptions {
  /** The deck's document exists (the first valid file): render the editor around it. */
  onOpen: (doc: DeckDoc, pictures: EmbedPictures) => void;
  waitMs?: number;
}

/** Bytes a deck file carried go into the deck's picture store, with nothing sent to the host. */
function remember(doc: DeckDoc, pictures: EmbedPictures, bytes: Map<string, Uint8Array>) {
  if (bytes.size === 0) return;
  const assets = readDeck(doc).assets;
  for (const [id, data] of bytes) {
    const type = assets?.[id]?.type;
    if (type !== undefined) pictures.store.remember(id, { type, bytes: data });
  }
}

export interface EmbedSession {
  /** Listens, says `ready` (once, even if started again), and arms the waiting message. */
  start(): () => void;
  /** The open deck registers the persistence that sends its edits; `null` when it goes away. */
  setPersistence(persistence: HostPersistence | null): void;
  send(message: EditorMessage): void;
  /** Sends what is pending to the host now (⌘S); resolves at once with nothing open. */
  flushPending(): Promise<void>;
}

/**
 * The editor's side of the protocol (contracts/host-protocol.md): handshake, version check, the
 * file the host sends and what the editor does with it. No React: `EmbedApp` renders what this
 * puts in the embed store and hands it the document once it exists.
 */
export function createEmbedSession(
  transport: Transport<EditorMessage, HostMessage>,
  options: EmbedSessionOptions,
): EmbedSession {
  const store = useEmbedStore;
  let doc: DeckDoc | null = null;
  let pictures: EmbedPictures | null = null;
  let persistence: HostPersistence | null = null;
  /** A valid-version `init` was seen: only then does `external-change` mean anything. */
  let initialized = false;
  let readySent = false;
  let fatalSent = false;
  /** An outside file that arrived before the open deck had attached its persistence. */
  let waitingText: string | null = null;

  const send = (message: EditorMessage) => {
    transport.send(message);
  };

  const report = (result: ApplyResult | 'echo') => {
    if (result === 'echo') return;
    if (result.status === 'refused') {
      persistence?.setBlocked(true);
      store.getState().blocked(result.entries);
      return;
    }
    persistence?.setBlocked(false);
    store.getState().opened();
    if (doc !== null && pictures !== null) remember(doc, pictures, result.bytes);
  };

  /** Opens the deck from the first file, or merges a later one into the open deck. */
  const take = (text: string) => {
    if (doc === null) {
      const fresh = createDeck();
      let bytes: Map<string, Uint8Array> | undefined;
      if (text !== '') {
        const result = applyDeckText(fresh, text, hostOrigin);
        if (result.status === 'refused') {
          report(result);
          return;
        }
        bytes = result.bytes;
      }
      doc = fresh;
      pictures = createEmbedPictures(fresh, send, () => store.getState().capabilities.pictures);
      if (bytes !== undefined) remember(fresh, pictures, bytes);
      store.getState().opened();
      options.onOpen(fresh, pictures);
      return;
    }
    if (persistence === null) {
      waitingText = text;
      return;
    }
    report(persistence.applyExternal(text));
  };

  const onInit = (message: Extract<HostMessage, { type: 'init' }>) => {
    if (message.protocolVersion !== PROTOCOL_VERSION) {
      // An open deck keeps working when a later `init` disagrees: it cannot be told apart from noise.
      if (doc !== null) return;
      if (!fatalSent) {
        fatalSent = true;
        send({
          type: 'fatal',
          code: 'protocol-version',
          editorVersion: APP_VERSION,
          protocolVersion: PROTOCOL_VERSION,
        });
      }
      // A newer host needs a newer editor; an older one needs updating itself.
      store.getState().failed(message.protocolVersion > PROTOCOL_VERSION ? 'editor' : 'host');
      return;
    }
    fatalSent = false;
    initialized = true;
    setThemeFromHost(message.theme);
    store.getState().setCapabilities(message.capabilities);
    take(message.text);
  };

  const onMessage = (message: HostMessage) => {
    switch (message.type) {
      case 'init':
        onInit(message);
        return;
      case 'theme':
        setThemeFromHost(message.scheme);
        return;
      case 'external-change':
        if (initialized) take(message.text);
        return;
      case 'change-result':
        persistence?.handleResult(message);
        return;
      case 'flush': {
        const done = () => {
          send({ type: 'flushed', requestId: message.requestId });
        };
        if (persistence === null) done();
        else void persistence.flush().then(done, done);
        return;
      }
      case 'picture-stored':
      case 'picture-store-failed':
      case 'picture':
      case 'picture-missing':
        pictures?.store.receive(message);
        return;
    }
  };

  return {
    send,
    flushPending: () => persistence?.flush() ?? Promise.resolve(),
    start() {
      store.getState().reset();
      const slow = setTimeout(() => {
        store.getState().slow();
      }, options.waitMs ?? WAIT_MS);
      const unlisten = transport.listen(onMessage);
      if (!readySent) {
        readySent = true;
        send({ type: 'ready', protocolVersion: PROTOCOL_VERSION, editorVersion: APP_VERSION });
      }
      return () => {
        clearTimeout(slow);
        unlisten();
      };
    },
    setPersistence(next) {
      persistence = next;
      if (next !== null && waitingText !== null) {
        const text = waitingText;
        waitingText = null;
        take(text);
      }
    },
  };
}
