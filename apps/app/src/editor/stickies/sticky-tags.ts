/**
 * The tag chips along the bottom of a note (053 R5): at most `MAX_NOTE_TAG_ROWS` rows, then a
 * "+N" chip for the rest, so tags never grow past the room the text fit reserved for them. Pure,
 * with the measurer injected; the chip widths come from `tagChips`, as on a card.
 */
import { tagRows, textMeasurer } from '../card-tags';
import type { TextMeasurer } from '../export/text-measure';
import type { TagLook } from '../tags/tag-colours';

export const MAX_NOTE_TAG_ROWS = 2;

export interface NoteTags {
  /** The tags drawn, in order. */
  shown: readonly TagLook[];
  /** How many more are behind the "+N" chip (0 = no chip). */
  hidden: number;
  /** Rows the chips take, "+N" included (0 without tags). */
  rows: number;
}

/** What the "+N" chip says. */
export const hiddenTagsLabel = (hidden: number): string => `+${String(hidden)}`;

/**
 * The most tags that fit in `maxRows` rows of `innerWidth` px. When some do not fit, the "+N" chip
 * takes the place of as many as it needs to fit itself.
 */
export function noteTags(
  tags: readonly TagLook[],
  innerWidth: number,
  measure: TextMeasurer = textMeasurer(),
  maxRows: number = MAX_NOTE_TAG_ROWS,
): NoteTags {
  if (tags.length === 0) return { shown: [], hidden: 0, rows: 0 };
  for (let count = tags.length; count >= 0; count -= 1) {
    const hidden = tags.length - count;
    const labels = tags.slice(0, count).map((tag) => tag.text);
    if (hidden > 0) labels.push(hiddenTagsLabel(hidden));
    const rows = tagRows(labels, innerWidth, measure);
    if (rows <= maxRows) return { shown: tags.slice(0, count), hidden, rows };
  }
  // Unreachable: a lone "+N" chip is one row. Keeps the types honest for `maxRows` below 1.
  return { shown: [], hidden: tags.length, rows: 1 };
}
