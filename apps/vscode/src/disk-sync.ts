import type { DeckDocument } from './deck-document';
import type { Flushable } from './document-ops';
import type { Disposable, Ports } from './ports';

/** Watcher events for one write often come in bursts; wait this long before reading. */
export const DEBOUNCE_MS = 50;

export const REPLACED_NOTICE =
  'The file changed on disk, so the canvas now shows the newer version. Your unsaved edits were replaced.';

export interface DiskSyncOptions {
  doc: DeckDocument;
  ports: Ports;
  /** The canvas for this document, if one is open. */
  session: () => Flushable | null;
  /** The tab should show "changed" (the file was deleted). */
  onContentChange: () => void;
  /** Clears the tab's changed mark after the disk replaced unsaved edits (R3, spike S1). */
  clearMark: () => Promise<void>;
}

/**
 * Follows the file on disk (R6, US3). Compares content, never timestamps: a write we made
 * ourselves, a touch that changes nothing and a `git checkout` that restores the same bytes all
 * compare equal and send nothing. At most one read is in flight; events during it cause one more.
 */
export class DiskSync implements Disposable {
  private readonly o: DiskSyncOptions;
  private watcher: Disposable | null = null;
  private cancelTimer: (() => void) | null = null;
  private running = false;
  private again = false;
  private disposed = false;

  constructor(options: DiskSyncOptions) {
    this.o = options;
  }

  /** Starts (or restarts, after a rename) watching the document's file. */
  watch(): void {
    this.watcher?.dispose();
    this.watcher = this.o.ports.watch.watch(this.o.doc.loc, () => {
      this.schedule();
    });
  }

  /** A watch event: read soon, once for a burst. */
  private schedule(): void {
    if (this.disposed || this.cancelTimer !== null) return;
    this.cancelTimer = this.o.ports.clock.setTimeout(() => {
      this.cancelTimer = null;
      void this.check();
    }, DEBOUNCE_MS);
  }

  /** Re-check now: the tab became visible or the window regained focus (watchers can miss). */
  recheck(): Promise<void> {
    return this.check();
  }

  async check(): Promise<void> {
    if (this.disposed) return;
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.again = false;
        await this.compare();
      } while (this.shouldRepeat());
    } finally {
      this.running = false;
    }
  }

  /** A method, because TypeScript would keep `again` and `disposed` narrowed across the await. */
  private shouldRepeat(): boolean {
    return this.again && !this.disposed;
  }

  private async compare(): Promise<void> {
    const { doc, ports } = this.o;
    let text: string;
    try {
      text = new TextDecoder().decode(await ports.files.read(doc.loc));
    } catch {
      // Gone (deleted, or a branch switch is mid-way): keep the document, offer save (FR-015).
      if (!doc.missing) {
        doc.missing = true;
        this.o.onContentChange();
      }
      return;
    }
    const wasDirty = doc.dirty;
    if (!doc.applyDisk(text)) {
      doc.missing = false;
      return;
    }
    // Invalid text is sent too: the canvas shows its problems and stays read-only (067 FR-014).
    this.o.session()?.sendExternalChange(text);
    if (wasDirty) {
      await this.o.clearMark();
      ports.ui.notify(REPLACED_NOTICE);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.watcher?.dispose();
    this.watcher = null;
  }
}
