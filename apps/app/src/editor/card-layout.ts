/**
 * The Deck card's size (029 R7): one pure function of the card's content and width, never of the
 * zoom level (§g-58). Text is wrapped with canvas `measureText` (the technique `card-tags.ts`
 * already uses) and cached per (text, width, font), so edges, group frames, layout and export all
 * agree with what the card draws without measuring the DOM.
 */
import { tagBlockHeight, textMeasurer, TAG_CHIP } from './card-tags';
import { graphemes, type TextMeasurer } from './export/text-measure';

/** Sizes snap to 4 px, as in a resize (017). */
const SIZE_STEP = 4;

/** Default card width; user-resizable (017). */
export const DECK_CARD_WIDTH = 184;

export const DECK_CARD = {
  paddingY: 12,
  paddingX: 13,
  gap: 8,
  headerHeight: 24,
  childrenRowHeight: 24,
  titleLineHeight: 18,
  descriptionLineHeight: 16.8,
  maxTitleLines: 3,
  maxDescriptionLines: 3,
  titleFont: "600 14px 'Geist Variable', system-ui, sans-serif",
  descriptionFont: "400 12px 'Geist Variable', system-ui, sans-serif",
} as const;

export interface CardLayoutInput {
  title: string;
  /** The view's subtitle text; empty or whitespace adds no region. */
  description?: string | undefined;
  tags?: readonly string[] | undefined;
  /** Components inside a card that holds some (the "n inside" row). */
  childCount?: number | undefined;
  /** A stored size (017): kept, but never below the minimum layout. */
  size?: { width: number; height: number } | undefined;
}

export interface CardLayout {
  width: number;
  height: number;
  /** 1–3. */
  titleLines: number;
  /** 0–3. */
  descriptionLines: number;
  /** Rows of tag pills (0 without tags). */
  tagRows: number;
  hasChildrenRow: boolean;
}

const lineCache = new Map<string, number>();
const LINE_CACHE_LIMIT = 20_000;

/** How many lines `text` wraps into across `maxWidth` px: words first, long words by character. */
function wrappedLines(text: string, maxWidth: number, font: string, measure: TextMeasurer): number {
  const key = `${font}\u0000${String(maxWidth)}\u0000${text}`;
  const known = lineCache.get(key);
  if (known !== undefined) return known;
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    let current = '';
    for (const word of paragraph.split(/\s+/).filter((w) => w !== '')) {
      const candidate = current === '' ? word : `${current} ${word}`;
      if (measure(candidate, font) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current !== '') lines += 1;
      current = '';
      if (measure(word, font) <= maxWidth) {
        current = word;
        continue;
      }
      // A word wider than the card breaks between characters, like CSS `overflow-wrap: anywhere`.
      for (const part of graphemes(word)) {
        const next = current + part;
        if (current !== '' && measure(next, font) > maxWidth) {
          lines += 1;
          current = part;
        } else {
          current = next;
        }
      }
    }
    if (current !== '') lines += 1;
  }
  if (lineCache.size >= LINE_CACHE_LIMIT) lineCache.clear();
  lineCache.set(key, lines);
  return lines;
}

function stepUp(height: number): number {
  // The epsilon keeps 16.8 × n products that land a hair above a step from adding a whole step.
  return Math.ceil(height / SIZE_STEP - 1e-9) * SIZE_STEP;
}

/**
 * Lays out a card of `width` px (the default, or the stored width when `input.size` is set).
 * Height = 12 + header 24 + 8 + title + (8 + description) + (8 + tags) + (8 + "n inside" row) + 12,
 * rounded up to the 4 px size step. A stored height wins but never goes below the minimum
 * (header, one title line, the tag block, padding); the lines shrink to what fits, title first.
 */
export function cardLayout(
  input: CardLayoutInput,
  width: number = DECK_CARD_WIDTH,
  measure: TextMeasurer = textMeasurer(),
): CardLayout {
  const cardWidth = input.size?.width ?? width;
  const inner = cardWidth - 2 * DECK_CARD.paddingX;
  const c = DECK_CARD;

  const title = Math.min(
    c.maxTitleLines,
    Math.max(1, wrappedLines(input.title, inner, c.titleFont, measure)),
  );
  const description = (input.description ?? '').trim();
  const naturalDescription =
    description === ''
      ? 0
      : Math.min(
          c.maxDescriptionLines,
          wrappedLines(description, inner, c.descriptionFont, measure),
        );
  const tagBlock = tagBlockHeight(input.tags, cardWidth, measure);
  // Rows back out of the block height, so the chips are measured once.
  const rows = tagBlock === 0 ? 0 : (tagBlock + TAG_CHIP.gap) / (TAG_CHIP.height + TAG_CHIP.gap);
  const hasChildrenRow = (input.childCount ?? 0) > 0;

  // Everything but the title and description lines.
  const chrome =
    2 * c.paddingY +
    c.headerHeight +
    c.gap +
    (tagBlock > 0 ? c.gap + tagBlock : 0) +
    (hasChildrenRow ? c.gap + c.childrenRowHeight : 0);
  const natural =
    chrome +
    title * c.titleLineHeight +
    (naturalDescription > 0 ? c.gap + naturalDescription * c.descriptionLineHeight : 0);

  if (input.size === undefined) {
    return {
      width: cardWidth,
      height: stepUp(natural),
      titleLines: title,
      descriptionLines: naturalDescription,
      tagRows: rows,
      hasChildrenRow,
    };
  }

  const height = Math.max(input.size.height, stepUp(chrome + c.titleLineHeight));
  const room = height - chrome;
  const titleLines = Math.max(1, Math.min(title, Math.floor(room / c.titleLineHeight)));
  const left = room - titleLines * c.titleLineHeight - c.gap;
  const descriptionLines =
    naturalDescription === 0 || titleLines < title
      ? 0
      : Math.max(
          0,
          Math.min(naturalDescription, Math.floor((left + 1e-9) / c.descriptionLineHeight)),
        );
  return { width: cardWidth, height, titleLines, descriptionLines, tagRows: rows, hasChildrenRow };
}
