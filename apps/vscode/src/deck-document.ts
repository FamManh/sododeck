import { emptyDeckText } from '@sododeck/model';

import { decode, kindOf, type FileKind, type Problem } from './file-codec';
import type { Loc } from './ports';

/**
 * One open deck file (data-model.md). Pure. `text` is always the deck text the canvas speaks,
 * kept byte for byte; `fileText` is what the file held when we last read or wrote it (for a
 * `.sododeck.md` note that is Markdown, and the `previous` that keeps the user's own text on
 * save). VS Code's own changed mark follows `dirty` through the events the provider fires.
 */
export class DeckDocument {
  loc: Loc;
  /** The latest deck text from the canvas, or the text the document started with. */
  text: string;
  /** The file text last read or written by us. */
  fileText: string;
  /** The deck text that file text decodes to; a clean document's `text` equals it. */
  savedDeckText: string;
  /** Set when a note cannot be decoded: read-only, never dirty, never saved. */
  problems: Problem[] | null = null;
  /** File text of our last save, to recognise its echo from the file watcher. */
  lastWritten: string | null = null;
  /** Highest `change.seq` seen; a stale or repeated one is ignored. */
  lastSeq = -1;
  /** The file was deleted on disk; the document stays and counts as changed so save is offered. */
  missing = false;

  private constructor(loc: Loc, fileText: string) {
    this.loc = loc;
    this.fileText = fileText;
    this.text = '';
    this.savedDeckText = '';
    this.adopt(fileText);
  }

  get kind(): FileKind {
    return kindOf(this.loc);
  }

  /**
   * What the canvas should be shown: the deck text, or for an unreadable note the file text, so
   * the canvas reports its own problems and stays read-only (067 FR-014).
   */
  get canvasText(): string {
    return this.problems === null ? this.text : this.fileText;
  }

  /** A document that starts clean from the file's text. */
  static fromDisk(loc: Loc, fileText: string): DeckDocument {
    return new DeckDocument(loc, fileText);
  }

  /** A document restored from a hot-exit backup: dirty against what the disk holds now. */
  static fromBackup(loc: Loc, backupFileText: string, diskFileText: string): DeckDocument {
    const doc = new DeckDocument(loc, diskFileText);
    const backup = doc.decodeFile(backupFileText);
    if (doc.problems === null && backup.ok) doc.text = backup.deckText;
    return doc;
  }

  get dirty(): boolean {
    return this.problems === null && (this.text !== this.savedDeckText || this.missing);
  }

  /** Plain files pass through verbatim; the host session shows an empty one as an empty deck. */
  private decodeFile(fileText: string): ReturnType<typeof decode> {
    if (this.kind === 'plain') return { ok: true, deckText: fileText };
    return fileText.trim() === ''
      ? { ok: true, deckText: emptyDeckText() }
      : decode('markdown', fileText);
  }

  /** Makes `fileText` the clean state of the document (or marks it unreadable). */
  private adopt(fileText: string): void {
    const decoded = this.decodeFile(fileText);
    this.fileText = fileText;
    if (decoded.ok) {
      this.problems = null;
      this.text = decoded.deckText;
      this.savedDeckText = decoded.deckText;
    } else {
      this.problems = decoded.problems;
      this.text = '';
      this.savedDeckText = '';
    }
    this.missing = false;
  }

  /**
   * Takes a canvas edit. Returns whether it was accepted (not stale) and whether the document
   * became or stayed different from the saved text, so the caller fires the content-change event.
   */
  applyChange(seq: number, text: string): { accepted: boolean; dirty: boolean } {
    if (seq <= this.lastSeq) return { accepted: false, dirty: this.dirty };
    this.lastSeq = seq;
    this.text = text;
    return { accepted: true, dirty: this.dirty };
  }

  /** A new webview starts its `seq` at 0 again. */
  resetSeq(): void {
    this.lastSeq = -1;
  }

  /** After a write: `deckText` is what the canvas had, `fileText` what went to the file. */
  markSaved(deckText: string = this.text, fileText: string = deckText): void {
    this.missing = false;
    this.savedDeckText = deckText;
    this.fileText = fileText;
    this.lastWritten = fileText;
  }

  /** Revert: the disk text becomes the clean state, even when equal to ours. */
  revertTo(diskFileText: string): void {
    this.adopt(diskFileText);
  }

  /**
   * The disk now holds `diskFileText`. False when it is nothing new (it is what we last wrote, or
   * decodes to the deck text the canvas has or the file had; only the user's own text changed).
   * True when it replaced the document; a replaced document is clean and keeps no unsaved edits.
   */
  applyDisk(diskFileText: string): boolean {
    if (this.problems === null && diskFileText === this.lastWritten) return false;
    const decoded = this.decodeFile(diskFileText);
    if (!decoded.ok) {
      if (this.problems !== null && diskFileText === this.fileText) return false;
      this.adopt(diskFileText);
      return true;
    }
    if (
      this.problems === null &&
      (decoded.deckText === this.text || decoded.deckText === this.savedDeckText)
    ) {
      this.fileText = diskFileText;
      return false;
    }
    this.adopt(diskFileText);
    return true;
  }
}
