import {
  memoryTransportPair,
  PROTOCOL_VERSION,
  type EditorMessage,
  type HostMessage,
  type Transport,
} from '@sododeck/host-protocol';

/** Lets queued microtasks and macrotask-free async work finish. */
export async function settle(rounds = 8): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => setImmediate(resolve));
}

/**
 * The editor's side of the conversation, scripted by the test (069 G3). It speaks through the
 * in-memory pair of `@sododeck/host-protocol`, so the host under test gets structured clones just
 * like a real webview would.
 */
export class FakeEditor {
  readonly host: Transport<HostMessage, EditorMessage>;
  private readonly editor: Transport<EditorMessage, HostMessage>;
  private readonly log: HostMessage[] = [];
  /** Every message this editor sent, for the self-test that checks it against the schemas. */
  readonly sent: EditorMessage[] = [];
  private seq = 0;
  /** Answer `flush` automatically with the latest sent text pending (nothing pending here). */
  autoFlush = true;
  /** The deck text the fake canvas currently holds. */
  canvasText = '';

  constructor() {
    const pair = memoryTransportPair();
    this.host = pair.host;
    this.editor = pair.editor;
    this.editor.listen((message) => {
      this.log.push(message);
      if (message.type === 'flush' && this.autoFlush) this.answerFlush(message.requestId);
    });
  }

  private post(message: EditorMessage): void {
    this.sent.push(message);
    this.editor.send(message);
  }

  ready(protocolVersion: number = PROTOCOL_VERSION, editorVersion = '0.0.0-test'): void {
    this.post({ type: 'ready', protocolVersion, editorVersion });
  }

  sendChange(text: string): number {
    const seq = this.seq++;
    this.canvasText = text;
    this.post({ type: 'change', seq, text });
    return seq;
  }

  answerFlush(requestId?: string): void {
    const id =
      requestId ?? [...this.log].reverse().find((m) => m.type === 'flush')?.requestId ?? 'none';
    this.post({ type: 'flushed', requestId: id });
  }

  putPicture(id: string, mime: string, name: string, bytes: Uint8Array): void {
    this.post({ type: 'picture-put', id, mime, name, bytes });
  }

  getPicture(id: string): void {
    this.post({ type: 'picture-get', id });
  }

  openLink(href: string): void {
    this.post({ type: 'open-link', href });
  }

  exportFile(name: string, mime: string, bytes: Uint8Array): void {
    this.post({ type: 'export-file', name, mime, bytes });
  }

  /** Sends a raw value the way a hostile or buggy page could. */
  raw(value: unknown): void {
    this.editor.send(value as EditorMessage);
  }

  recorded(): readonly HostMessage[] {
    return this.log;
  }

  of<T extends HostMessage['type']>(type: T): Extract<HostMessage, { type: T }>[] {
    return this.log.filter((m): m is Extract<HostMessage, { type: T }> => m.type === type);
  }

  clear(): void {
    this.log.length = 0;
  }
}
