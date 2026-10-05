/**
 * A note's text as plain wrapped lines (053, export): markdown stripped, then fitted with the same
 * `FIT_STEPS` the canvas uses, but measured with a text measurer instead of the DOM, so it runs
 * off the main thread and in tests. Pure; the measurer is injected.
 */
import { parseMarkdown, type Inline } from '@sododeck/ui/lib/markdown';

import { wrapText } from '../card-layout';
import type { TextMeasurer } from '../export/text-measure';
import { FIT_STEPS, MIN_FIT_FONT_SIZE } from './fit-font-size';

/** Line height as a multiple of the font size; the canvas text uses the body-sm leading. */
export const NOTE_LINE_HEIGHT = 1.4;

const LINK = /\[([^\]]+)\]\([^)]*\)/g;

const inlineText = (content: readonly Inline[]): string =>
  content
    .map((part) =>
      part.kind === 'text' || part.kind === 'code' ? part.text : inlineText(part.content),
    )
    .join('');

/** The text with emphasis markers, code ticks and link targets removed; bullets become "• ". */
export function plainNoteText(markdown: string): string {
  return parseMarkdown(markdown.replace(LINK, '$1'))
    .flatMap((block) =>
      block.kind === 'paragraph'
        ? [inlineText(block.content)]
        : block.items.map((item) => `• ${inlineText(item)}`),
    )
    .join('\n');
}

export interface PlainNoteFit {
  fontSize: number;
  lines: readonly string[];
  lineHeight: number;
  /** True when even the minimum size overflows: the lines are cut to the rows that fit. */
  clipped: boolean;
}

export interface PlainNoteBox {
  markdown: string;
  /** The text box in px: the note less its padding and the tag rows. */
  width: number;
  height: number;
  /** A pinned size skips fitting. */
  fontSize?: number | undefined;
  /** Font family part of the CSS `font` shorthand, e.g. `'Geist Variable', sans-serif`. */
  family: string;
}

const fontOf = (size: number, family: string): string => `${String(size)}px ${family}`;

/** Largest step whose wrapped lines fit; a pinned size or the minimum is cut to the rows that fit. */
export function fitPlainNote(box: PlainNoteBox, measure: TextMeasurer): PlainNoteFit {
  const text = plainNoteText(box.markdown);
  const steps = box.fontSize === undefined ? FIT_STEPS : [box.fontSize];
  for (const size of steps) {
    const lines = wrapText(text, box.width, fontOf(size, box.family), measure);
    const lineHeight = size * NOTE_LINE_HEIGHT;
    if (lines.length * lineHeight <= box.height) {
      return { fontSize: size, lines, lineHeight, clipped: false };
    }
  }
  const size = box.fontSize ?? MIN_FIT_FONT_SIZE;
  const lineHeight = size * NOTE_LINE_HEIGHT;
  const lines = wrapText(text, box.width, fontOf(size, box.family), measure);
  const rows = Math.max(0, Math.floor(box.height / lineHeight));
  return { fontSize: size, lines: lines.slice(0, rows), lineHeight, clipped: true };
}
