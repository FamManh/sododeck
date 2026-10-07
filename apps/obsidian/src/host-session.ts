/**
 * One canvas ↔ one deck file (070 plan: host-session). All protocol logic of the host side lives
 * here and in the modules it calls; it imports nothing from `obsidian`.
 *
 * The document stays in the canvas (Principle I): the session keeps only texts (what the canvas
 * holds, what was last written) to write, to tell an echo from an outside change, and to keep the
 * user's own text in a Markdown note.
 */
import {
  parseEditorMessage,
  PROTOCOL_VERSION,
  type Capabilities,
  type EditorMessage,
  type HostMessage,
  type Transport,
} from '@sododeck/host-protocol';

import { judge } from './disk-sync';
import { decode, encode, kindOfPath, type FileKind } from './file-codec';
import { PictureHost, type PictureAnswer } from './picture-host';
import type { Ports, Scheme, VaultEvent } from './ports';

/** How long a close waits for the canvas to answer `flush` before it uses the last text it has. */
export const FLUSH_TIMEOUT_MS = 1500;

export const REPLACED_NOTICE =
  'Sododeck: this deck was changed outside the canvas, so your last edits were replaced.';
export const MISMATCH_NOTICE =
  'Sododeck: the canvas and the plugin do not match. Update the Sododeck plugin to fix this.';

export interface SessionOptions {
  /** Vault path of the deck file. */
  path: string;
  /** The file's text when the view opened it. */
  fileText: string;
  transport: Transport<HostMessage, EditorMessage>;
  ports: Ports;
}

type Phase = 'waiting' | 'ready' | 'fatal';

export class HostSession {
  private path: string;
  private readonly kind: FileKind;
  private readonly transport: Transport<HostMessage, EditorMessage>;
  private readonly ports: Ports;
  private readonly pictures: PictureHost;
  private readonly subscriptions: (() => void)[] = [];

  private phase: Phase = 'waiting';
  private capabilities: Capabilities;
  private lastScheme: Scheme;

  /** The file's text as last read or written: `previous` for the Markdown form. */
  private lastFileText: string;
  /** Deck text the canvas holds: last sent to it or received from it. */
  private canvasText: string | undefined;
  /** Deck text of our last finished write and of the one in flight (echo checks). */
  private writtenText: string | undefined;
  private inFlightText: string | undefined;
  /** Newest `change` not yet written, with its seq; kept until written (FR-016). */
  private pending: { text: string; seq: number } | undefined;
  private draining: Promise<void> | undefined;
  /** The file cannot be read as a deck: the canvas keeps the last good deck, nothing is written. */
  private broken = false;
  private initSent = false;
  private flushing: Promise<void> | undefined;
  private readonly flushWaiters = new Map<string, () => void>();
  private nextRequest = 0;
  private reading = false;
  private readAgain = false;
  private closed = false;

  constructor(options: SessionOptions) {
    this.path = options.path;
    this.kind = kindOfPath(options.path);
    this.transport = options.transport;
    this.ports = options.ports;
    this.lastFileText = options.fileText;
    this.capabilities = this.computeCapabilities();
    this.lastScheme = this.ports.theme.scheme();
    this.pictures = new PictureHost(
      { path: () => this.path, kind: this.kind, deckText: () => this.canvasText ?? '' },
      this.ports,
    );

    const first = decode(this.kind, options.fileText);
    if (first.ok) {
      this.canvasText = first.deckText;
      this.writtenText = first.deckText;
    } else {
      this.broken = true;
    }

    this.subscriptions.push(
      this.transport.listen((message) => {
        this.onMessage(message);
      }),
      this.ports.theme.onChange(() => {
        this.onThemeChange();
      }),
      this.ports.settings.onChange(() => {
        this.onSettingsChange();
      }),
      this.ports.files.onChange((event) => {
        this.onVaultEvent(event);
      }),
    );
  }

  private computeCapabilities(): Capabilities {
    return {
      openLinks: false,
      exportFiles: false,
      pictures: this.kind === 'markdown' && this.ports.settings.pictureStorage() === 'attachments',
    };
  }

  private send(message: HostMessage): void {
    if (!this.closed) this.transport.send(message);
  }

  // ------------------------------------------------------------------ messages from the canvas

  private onMessage(raw: EditorMessage): void {
    const message = parseEditorMessage(raw);
    if (message === null || this.closed) return;
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
        this.flushWaiters.get(message.requestId)?.();
        return;
      case 'picture-put':
        void this.answer(() => this.pictures.put(message, this.capabilities.pictures));
        return;
      case 'picture-get':
        void this.answer(() => this.pictures.get(message));
        return;
      case 'open-link':
      case 'export-file':
      case 'fatal':
        // Capabilities for links and exports are off in this host; nothing to do.
        return;
    }
  }

  private async answer(action: () => Promise<PictureAnswer>): Promise<void> {
    try {
      this.send(await action());
    } catch (error) {
      this.ports.ui.notice(
        `Sododeck could not finish that action: ${error instanceof Error ? error.message : 'unknown error'}.`,
      );
    }
  }

  private onReady(protocolVersion: number): void {
    this.capabilities = this.computeCapabilities();
    if (protocolVersion !== PROTOCOL_VERSION) {
      // No deck content goes to an editor on another protocol; our version in `init` makes the
      // editor say which side needs an update (067 FR-003). Nothing is ever written.
      this.phase = 'fatal';
      this.send({
        type: 'init',
        protocolVersion: PROTOCOL_VERSION,
        text: '',
        theme: this.ports.theme.scheme(),
        capabilities: { openLinks: false, exportFiles: false, pictures: false },
      });
      this.ports.ui.notice(MISMATCH_NOTICE);
      return;
    }
    this.phase = 'ready';
    if (this.broken) {
      this.reportBroken(decode(this.kind, this.lastFileText));
      return;
    }
    this.sendInit();
  }

  private sendInit(): void {
    if (this.canvasText === undefined) return;
    this.lastScheme = this.ports.theme.scheme();
    this.initSent = true;
    this.send({
      type: 'init',
      protocolVersion: PROTOCOL_VERSION,
      text: this.canvasText,
      theme: this.lastScheme,
      capabilities: this.capabilities,
    });
  }

  private reportBroken(decoded: ReturnType<typeof decode>): void {
    if (!decoded.ok) this.ports.ui.showErrorPane(decoded.problems);
  }

  // ------------------------------------------------------------------ canvas edits → file

  private onChange(seq: number, text: string): void {
    this.canvasText = text;
    this.pending = { text, seq };
    void this.drain();
  }

  /** Writes the newest pending text, one write at a time; a text replaced while writing is not written. */
  private drain(): Promise<void> {
    this.draining ??= this.pump().finally(() => {
      this.draining = undefined;
    });
    return this.draining;
  }

  private async pump(): Promise<void> {
    while (this.pending !== undefined && !this.closed) {
      const { text, seq } = this.pending;
      if (this.broken) {
        this.pending = undefined;
        this.send({
          type: 'change-result',
          seq,
          ok: false,
          reason: 'the file cannot be read as a deck, so nothing was saved',
        });
        return;
      }
      const fileText = encode(this.kind, text, this.lastFileText);
      if (fileText === this.lastFileText) {
        // Nothing to write (FR-013): an equal file is never written.
        this.pending = undefined;
        this.writtenText = text;
        this.send({ type: 'change-result', seq, ok: true });
        continue;
      }
      this.inFlightText = text;
      try {
        await this.ports.files.writeText(this.path, fileText);
      } catch (error) {
        this.inFlightText = undefined;
        const reason = error instanceof Error ? error.message : 'unknown error';
        const name = this.path.slice(this.path.lastIndexOf('/') + 1);
        this.ports.ui.notice(
          `Sododeck could not save "${name}": ${reason}. Your edits are kept and will be saved on the next change.`,
        );
        // The text stays pending (retried on the next change and on flush).
        this.send({ type: 'change-result', seq, ok: false, reason });
        return;
      }
      this.inFlightText = undefined;
      this.lastFileText = fileText;
      this.writtenText = text;
      this.clearPending(seq);
      this.send({ type: 'change-result', seq, ok: true });
    }
  }

  /** A method, because TypeScript would keep the fields narrowed across an `await`. */
  private clearPending(seq: number): void {
    if (this.pending?.seq === seq) this.pending = undefined;
  }

  private wantsAnotherRead(): boolean {
    return this.readAgain && !this.closed;
  }

  // ------------------------------------------------------------------ the file → canvas

  private onVaultEvent(event: VaultEvent): void {
    if (this.closed) return;
    if (event.kind === 'rename' && event.oldPath === this.path) {
      this.path = event.path;
      return;
    }
    if (event.kind === 'delete' && event.path === this.path) return;
    if ((event.kind === 'modify' || event.kind === 'create') && event.path === this.path) {
      this.scheduleRead();
    }
    if (this.phase === 'ready') {
      void this.lateAnswers(event);
    }
  }

  private async lateAnswers(event: VaultEvent): Promise<void> {
    try {
      for (const answer of await this.pictures.retry(event)) this.send(answer);
    } catch {
      // A failed retry leaves the picture reported missing; the next event tries again.
    }
  }

  private scheduleRead(): void {
    if (this.reading) {
      this.readAgain = true;
      return;
    }
    this.reading = true;
    void (async () => {
      try {
        do {
          this.readAgain = false;
          let text: string;
          try {
            text = await this.ports.files.readText(this.path);
          } catch {
            return;
          }
          this.onFileText(text);
        } while (this.wantsAnotherRead());
      } finally {
        this.reading = false;
      }
    })();
  }

  /** The file's text as it is now (a change event, or the view's reload). Compared by content. */
  onFileText(text: string): void {
    if (this.closed) return;
    const decoded = decode(this.kind, text);
    const verdict = judge(decoded, {
      canvas: this.canvasText,
      written: this.writtenText,
      inFlight: this.inFlightText,
    });
    if (verdict.kind === 'broken') {
      this.broken = true;
      this.lastFileText = text;
      this.ports.ui.showErrorPane(verdict.problems);
      return;
    }
    const wasBroken = this.broken;
    this.broken = false;
    this.lastFileText = text;
    if (verdict.kind === 'ignore') {
      // A user edit outside the owned region, or our own write coming back.
      if (wasBroken && decoded.ok) {
        this.canvasText = decoded.deckText;
        this.writtenText = decoded.deckText;
        this.resend();
      }
      return;
    }
    if (this.pending !== undefined) {
      // Edits not yet written lose to the file (FR-020); say so once.
      this.pending = undefined;
      this.ports.ui.notice(REPLACED_NOTICE);
    }
    this.canvasText = verdict.deckText;
    this.writtenText = verdict.deckText;
    this.resend();
  }

  /** Show `canvasText`: as the first `init` when none was sent, else as an outside change. */
  private resend(): void {
    if (this.phase !== 'ready' || this.canvasText === undefined) return;
    if (!this.initSent) this.sendInit();
    else this.send({ type: 'external-change', text: this.canvasText });
  }

  // ------------------------------------------------------------------ theme and settings

  private onThemeChange(): void {
    const scheme = this.ports.theme.scheme();
    if (this.phase !== 'ready' || scheme === this.lastScheme) return;
    this.lastScheme = scheme;
    this.send({ type: 'theme', scheme });
  }

  private onSettingsChange(): void {
    const next = this.computeCapabilities();
    const same =
      next.pictures === this.capabilities.pictures &&
      next.openLinks === this.capabilities.openLinks &&
      next.exportFiles === this.capabilities.exportFiles;
    if (same) return;
    this.capabilities = next;
    // 067: a second `init` counts as an outside change with the new abilities. The text is what
    // the canvas holds, so nothing moves on the canvas.
    if (this.phase === 'ready' && this.initSent) this.sendInit();
  }

  // ------------------------------------------------------------------ flush and close

  /** Asks the canvas to send what is pending, waits for its answer, then writes (FR-008). */
  flush(): Promise<void> {
    this.flushing ??= this.doFlush().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }

  private async doFlush(): Promise<void> {
    if (this.phase === 'ready' && !this.closed) {
      const requestId = `flush-${String(this.nextRequest++)}`;
      await new Promise<void>((resolve) => {
        const cancel = this.ports.clock.setTimeout(() => {
          this.flushWaiters.delete(requestId);
          this.ports.ui.notice(
            'Sododeck: the canvas did not answer in time; saved the last edit it had sent.',
          );
          resolve();
        }, FLUSH_TIMEOUT_MS);
        this.flushWaiters.set(requestId, () => {
          cancel();
          this.flushWaiters.delete(requestId);
          resolve();
        });
        this.send({ type: 'flush', requestId });
      });
    }
    // The canvas's last `change` arrives before `flushed`: write whatever is pending now.
    await this.settleWrites();
  }

  private async settleWrites(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await this.drain();
      if (this.pending === undefined || this.closed) return;
      // A failed write leaves the text pending; one more try is the flush's retry (FR-010).
      if (i > 0) return;
    }
  }

  /** Flushes, then stops: nothing is sent or written afterwards. */
  async close(): Promise<void> {
    if (this.closed) return;
    await this.flush();
    this.dispose();
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    for (const stop of this.subscriptions) stop();
    this.subscriptions.length = 0;
    for (const resolve of this.flushWaiters.values()) resolve();
    this.flushWaiters.clear();
  }
}
