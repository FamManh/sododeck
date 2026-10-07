import {
  parseEditorMessage,
  PROTOCOL_VERSION,
  type Capabilities,
  type EditorMessage,
  type HostMessage,
  type Transport,
} from '@sododeck/host-protocol';
import { createDeck, inspectDeckText, serializeDeck, toJSON } from '@sododeck/model';

import { computeCapabilities } from './capabilities';
import type { DeckDocument } from './deck-document';
import { handleExportFile, handleOpenLink } from './host-links-exports';
import { PictureHost } from './picture-host';
import type { Disposable, Ports } from './ports';

/** How long a save waits for the canvas to answer `flush` before it uses the last text. */
export const FLUSH_TIMEOUT_MS = 2000;

export interface SessionOptions {
  doc: DeckDocument;
  /** The host end of the channel to the one webview. */
  transport: Transport<HostMessage, EditorMessage>;
  ports: Ports;
  /** The tab should show "changed": VS Code's content-change event (R2). */
  onContentChange: () => void;
}

export type Phase = 'waiting' | 'ready' | 'fatal';

/** Schemes that cannot take new files next to the deck. */
const READ_ONLY_SCHEMES = new Set(['untitled', 'git', 'gitfs', 'output', 'vscode-userdata']);

/** The canonical text of an empty deck: what an empty file opens as. */
export function emptyDeckText(): string {
  return serializeDeck(toJSON(createDeck()));
}

/**
 * One canvas ↔ one document (plan: host-session). All protocol logic of the host side lives here
 * and in the modules it calls; it imports nothing from `vscode`.
 */
export class HostSession {
  phase: Phase = 'waiting';

  private readonly doc: DeckDocument;
  private readonly transport: Transport<HostMessage, EditorMessage>;
  private readonly ports: Ports;
  private readonly onContentChange: () => void;
  private readonly pictures: PictureHost;
  private readonly subscriptions: (Disposable | (() => void))[] = [];
  private readonly pendingFlush = new Map<string, () => void>();
  private capabilities: Capabilities;
  private lastScheme: string;
  private nextRequest = 0;
  private offered = false;
  private disposed = false;

  constructor(options: SessionOptions) {
    this.doc = options.doc;
    this.transport = options.transport;
    this.ports = options.ports;
    this.onContentChange = options.onContentChange;
    this.pictures = new PictureHost(
      () => this.doc.loc,
      () => this.doc.text,
      this.ports,
    );
    this.capabilities = this.computeCapabilities();
    this.lastScheme = this.ports.theme.scheme();

    this.subscriptions.push(
      this.transport.listen((message) => {
        this.onMessage(message);
      }),
    );
    this.subscriptions.push(
      this.ports.theme.onChange(() => {
        this.onThemeChange();
      }),
    );
    const recompute = (): void => {
      this.onCapabilitiesMaybeChanged();
    };
    this.subscriptions.push(this.ports.settings.onChange(recompute));
    this.subscriptions.push(this.ports.trust.onDidGrant(recompute));
  }

  private get untitled(): boolean {
    return this.ports.files.scheme(this.doc.loc) === 'untitled';
  }

  private computeCapabilities(): Capabilities {
    return computeCapabilities({
      setting: this.ports.settings.picturesStorage(this.doc.loc),
      untitled: this.untitled,
      trusted: this.ports.trust.isTrusted(),
      writable: !READ_ONLY_SCHEMES.has(this.ports.files.scheme(this.doc.loc)),
    });
  }

  private send(message: HostMessage): void {
    if (!this.disposed) this.transport.send(message);
  }

  /** The text the canvas should show for the document as it stands. */
  private initText(): string {
    return this.doc.text.trim() === '' ? emptyDeckText() : this.doc.text;
  }

  private onMessage(raw: EditorMessage): void {
    const message = parseEditorMessage(raw);
    if (message === null || this.disposed) return;
    if (message.type === 'ready') {
      this.onReady(message.protocolVersion);
      return;
    }
    if (this.phase !== 'ready') return;
    switch (message.type) {
      case 'change':
        this.onChange(message.seq, message.text);
        return;
      case 'flushed':
        this.pendingFlush.get(message.requestId)?.();
        return;
      case 'picture-put':
        void this.guarded(async () => {
          this.send(await this.pictures.put(message));
        });
        return;
      case 'picture-get':
        void this.guarded(async () => {
          this.send(await this.pictures.get(message));
        });
        return;
      case 'open-link':
        void this.guarded(() => handleOpenLink(message, this.doc.loc, this.untitled, this.ports));
        return;
      case 'export-file':
        void this.guarded(() => handleExportFile(message, this.doc.loc, this.untitled, this.ports));
        return;
      case 'fatal':
        return;
    }
  }

  /** A handler that fails must not become an unhandled rejection in the extension host. */
  private async guarded(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.ports.ui.warn(
        `Sododeck could not finish that action: ${error instanceof Error ? error.message : 'unknown error'}.`,
      );
    }
  }

  private onReady(protocolVersion: number): void {
    // A webview that reloads (a hidden tab shown again) starts its `seq` over and gets the
    // document as it stands now, unsaved edits included.
    this.doc.resetSeq();
    this.capabilities = this.computeCapabilities();
    if (protocolVersion !== PROTOCOL_VERSION) {
      // No deck content goes to an editor on another protocol; our version in `init` makes the
      // editor show which side needs an update (067 FR-003). Nothing else is ever written.
      this.phase = 'fatal';
      this.send({
        type: 'init',
        protocolVersion: PROTOCOL_VERSION,
        text: '',
        theme: this.ports.theme.scheme(),
        capabilities: { openLinks: false, exportFiles: false, pictures: false },
      });
      return;
    }
    this.phase = 'ready';
    this.sendInit();
    if (!inspectDeckText(this.initText()).ok && !this.offered) {
      this.offered = true;
      this.ports.ui.offerOpenAsText(this.doc.loc);
    }
  }

  private sendInit(): void {
    this.lastScheme = this.ports.theme.scheme();
    this.send({
      type: 'init',
      protocolVersion: PROTOCOL_VERSION,
      text: this.initText(),
      theme: this.lastScheme,
      capabilities: this.capabilities,
    });
  }

  private onChange(seq: number, text: string): void {
    const result = this.doc.applyChange(seq, text);
    if (!result.accepted) return;
    this.send({ type: 'change-result', seq, ok: true });
    if (result.dirty) this.onContentChange();
  }

  private onThemeChange(): void {
    const scheme = this.ports.theme.scheme();
    if (this.phase !== 'ready' || scheme === this.lastScheme) return;
    this.lastScheme = scheme;
    this.send({ type: 'theme', scheme });
  }

  private onCapabilitiesMaybeChanged(): void {
    const next = this.computeCapabilities();
    const same =
      next.pictures === this.capabilities.pictures &&
      next.openLinks === this.capabilities.openLinks &&
      next.exportFiles === this.capabilities.exportFiles;
    if (same) return;
    this.capabilities = next;
    // 067: a second `init` counts as an outside change with the new abilities; the text is the
    // document's own, so nothing moves on the canvas and the tab is not marked.
    if (this.phase === 'ready') this.sendInit();
  }

  /** The file changed outside the editor, or the document was reverted: show `text`. */
  sendExternalChange(text: string): void {
    if (this.phase !== 'ready') return;
    this.send({ type: 'external-change', text });
  }

  /** Asks the canvas to send what is pending, and waits for its answer (FR-007). */
  flush(): Promise<void> {
    if (this.phase !== 'ready' || this.disposed) return Promise.resolve();
    const requestId = `flush-${String(this.nextRequest++)}`;
    return new Promise<void>((resolve) => {
      const done = (): void => {
        cancel();
        this.pendingFlush.delete(requestId);
        resolve();
      };
      const cancel = this.ports.clock.setTimeout(() => {
        this.pendingFlush.delete(requestId);
        this.ports.ui.warn(
          'The canvas did not answer in time; saved the last edit Sododeck had received.',
        );
        resolve();
      }, FLUSH_TIMEOUT_MS);
      this.pendingFlush.set(requestId, done);
      this.send({ type: 'flush', requestId });
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const s of this.subscriptions) {
      if (typeof s === 'function') s();
      else s.dispose();
    }
    for (const resolve of this.pendingFlush.values()) resolve();
    this.pendingFlush.clear();
  }
}
