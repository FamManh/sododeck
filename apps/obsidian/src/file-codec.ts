/**
 * Per file kind: what is on disk ↔ the deck text the canvas speaks (070 R5). `.sododeck` passes
 * through (the canvas writes canonical JSON and nothing here reformats it); `.sododeck.md` goes
 * through the model's Markdown form in both directions. The canvas never sees Markdown.
 */
import { emptyDeckText, fromMarkdown, toMarkdown } from '@sododeck/model';

export type FileKind = 'plain' | 'markdown';

export interface Problem {
  message: string;
  fix: string;
}

export type Decoded = { ok: true; deckText: string } | { ok: false; problems: Problem[] };

/**
 * Any `.md` note that reaches the deck view carries the marker (the view swap checks it), so it is
 * a deck note whatever its name: `Shop.sododeck.md` or `test 2.md`.
 */
export function kindOfPath(path: string): FileKind {
  return /\.md$/i.test(path) ? 'markdown' : 'plain';
}

/** The deck text the canvas should show for a file's text. An empty file is an empty deck. */
export function decode(kind: FileKind, fileText: string): Decoded {
  if (kind === 'plain') {
    return { ok: true, deckText: fileText.trim() === '' ? emptyDeckText() : fileText };
  }
  const read = fromMarkdown(fileText);
  if (read.ok) return { ok: true, deckText: read.deckText };
  return { ok: false, problems: read.entries.map((e) => ({ message: e.message, fix: e.fix })) };
}

/** The file text for a deck text; `previous` is the last file text, so the user's own text is kept. */
export function encode(kind: FileKind, deckText: string, previous?: string): string {
  return kind === 'plain' ? deckText : toMarkdown(deckText, previous);
}
