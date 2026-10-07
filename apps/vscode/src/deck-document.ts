import type { Loc } from './ports';

/**
 * One open deck file (data-model.md). Pure: the text is whatever the canvas last sent, kept byte
 * for byte, and `savedText` is what the disk held when we last read or wrote it. VS Code's own
 * changed mark follows `dirty` through the events the provider fires.
 */
export class DeckDocument {
  loc: Loc;
  /** The latest file text from the canvas, or the text the document started with. */
  text: string;
  /** What the disk held when last read or written by us. */
  savedText: string;
  /** Text of our last save, to recognise its echo from the file watcher. */
  lastWritten: string | null = null;
  /** Highest `change.seq` seen; a stale or repeated one is ignored. */
  lastSeq = -1;

  private constructor(loc: Loc, text: string, savedText: string) {
    this.loc = loc;
    this.text = text;
    this.savedText = savedText;
  }

  /** A document that starts clean from the file's text. */
  static fromDisk(loc: Loc, diskText: string): DeckDocument {
    return new DeckDocument(loc, diskText, diskText);
  }

  /** A document restored from a hot-exit backup: dirty against what the disk holds now. */
  static fromBackup(loc: Loc, backupText: string, diskText: string): DeckDocument {
    return new DeckDocument(loc, backupText, diskText);
  }

  get dirty(): boolean {
    return this.text !== this.savedText;
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

  markSaved(text: string = this.text): void {
    this.savedText = text;
    this.lastWritten = text;
  }

  /**
   * The disk now holds `diskText`. False when it is nothing new (it equals what the canvas has,
   * what we last read, or what we last wrote); true when it replaced the document. A replaced
   * document is clean and keeps no unsaved edits.
   */
  applyDisk(diskText: string): boolean {
    if (diskText === this.text || diskText === this.savedText || diskText === this.lastWritten) {
      return false;
    }
    this.text = diskText;
    this.savedText = diskText;
    return true;
  }
}
