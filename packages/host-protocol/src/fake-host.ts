import {
  PROTOCOL_VERSION,
  type Capabilities,
  type EditorMessage,
  type HostMessage,
} from './messages';
import type { Transport } from './transports';

export interface StoredPicture {
  mime: string;
  bytes: Uint8Array;
}

export interface FakeHostOptions {
  /** File text sent in `init` (default: empty file). */
  text?: string;
  theme?: string;
  capabilities?: Partial<Capabilities>;
  /** Sent in `init` (default `PROTOCOL_VERSION`); set another value to test a mismatch. */
  protocolVersion?: number;
  /** `false`: never answer `change` (tests the 5 s no-answer path). Default true. */
  answerChanges?: boolean;
  /** Pictures the host can serve for `picture-get`. */
  pictures?: Map<string, StoredPicture>;
  /** Answer every `picture-put` with `picture-store-failed`. */
  refusePictures?: boolean;
}

export interface LogEntry {
  dir: 'in' | 'out';
  message: EditorMessage | HostMessage;
  at: number;
}

export interface FakeHost {
  readonly log: LogEntry[];
  /** Text of the latest `change`, or `null` before any. */
  lastText(): string | null;
  /** Sends `init` now (also sent automatically on `ready`). */
  sendInit(): void;
  sendExternal(text: string): void;
  setTheme(scheme: string): void;
  /** Sends `flush`; resolves when the matching `flushed` arrives. */
  flush(): Promise<void>;
  /** The next `change` is answered `ok: false` with this reason, once. */
  refuseNextChange(reason: string): void;
  /** Mutable: change what later messages do. */
  options: FakeHostOptions;
}

/** A scripted host for component tests and the dev page. Records all traffic both ways. */
export function createFakeHost(
  transport: Transport<HostMessage, EditorMessage>,
  options: FakeHostOptions = {},
): FakeHost {
  const log: LogEntry[] = [];
  let last: string | null = null;
  let refusal: string | null = null;
  let requests = 0;
  const waiting = new Map<string, () => void>();

  const send = (message: HostMessage) => {
    log.push({ dir: 'out', message, at: Date.now() });
    transport.send(message);
  };
  const sendInit = () => {
    send({
      type: 'init',
      protocolVersion: host.options.protocolVersion ?? PROTOCOL_VERSION,
      text: host.options.text ?? '',
      theme: host.options.theme ?? 'light',
      capabilities: {
        openLinks: false,
        exportFiles: false,
        pictures: false,
        ...host.options.capabilities,
      },
    });
  };

  transport.listen((message) => {
    log.push({ dir: 'in', message, at: Date.now() });
    switch (message.type) {
      case 'ready':
        sendInit();
        break;
      case 'change': {
        last = message.text;
        if (host.options.answerChanges === false) break;
        if (refusal !== null) {
          send({ type: 'change-result', seq: message.seq, ok: false, reason: refusal });
          refusal = null;
        } else {
          send({ type: 'change-result', seq: message.seq, ok: true });
        }
        break;
      }
      case 'flushed':
        waiting.get(message.requestId)?.();
        waiting.delete(message.requestId);
        break;
      case 'picture-get': {
        const found = host.options.pictures?.get(message.id);
        if (found === undefined) {
          send({ type: 'picture-missing', id: message.id, reason: 'No such picture' });
        } else {
          send({ type: 'picture', id: message.id, mime: found.mime, bytes: found.bytes });
        }
        break;
      }
      case 'picture-put':
        if (host.options.refusePictures === true) {
          send({ type: 'picture-store-failed', id: message.id, reason: 'Pictures are refused' });
        } else {
          send({ type: 'picture-stored', id: message.id, path: `assets/${message.name}` });
        }
        break;
      default:
        break;
    }
  });

  const host: FakeHost = {
    log,
    options,
    lastText: () => last,
    sendInit,
    sendExternal: (text) => {
      send({ type: 'external-change', text });
    },
    setTheme: (scheme) => {
      send({ type: 'theme', scheme });
    },
    flush: () =>
      new Promise<void>((resolve) => {
        const requestId = `flush-${String(++requests)}`;
        waiting.set(requestId, resolve);
        send({ type: 'flush', requestId });
      }),
    refuseNextChange: (reason) => {
      refusal = reason;
    },
  };
  return host;
}
