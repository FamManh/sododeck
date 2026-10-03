/**
 * Tags shown on a card (founder, 2026-10-03): up to ten chips that wrap under the title, and the
 * card grows to fit them. The height is computed here, not measured in the DOM, so `cardSize`
 * (and with it edges, group frames, layout and export) agrees with what the card draws; zooming
 * never changes it.
 */
import { canvasMeasurer, fixedWidthMeasurer, type TextMeasurer } from './export/text-measure';

export const MAX_CARD_TAGS = 10;

/** The Deck tag pill (029, DESIGN.md `--sd-deck-tag`): 18 tall, padding 0 6, gap 4, Geist 10.5 / 500. */
export const TAG_CHIP = {
  height: 18,
  gap: 4,
  paddingX: 6,
  /** The card's horizontal padding (13) on each side. */
  cardPaddingX: 13,
  font: "500 10.5px 'Geist Variable', system-ui, sans-serif",
  /** Slack per chip, for a font still loading or sub-pixel rounding: never wrap later than CSS. */
  slack: 2,
} as const;

/** The tags a card shows: the first ten, older decks may hold more. */
export function cardTags(tags: readonly string[] | undefined): readonly string[] {
  return (tags ?? []).slice(0, MAX_CARD_TAGS);
}

/** One tag pill's place in the tag block: `row` from 0, `x` from the block's left edge. */
export interface TagChip {
  tag: string;
  row: number;
  x: number;
  width: number;
}

/** Where each chip sits when they wrap across `innerWidth` px; the card and the export share it. */
export function tagChips(
  tags: readonly string[],
  innerWidth: number,
  measure: TextMeasurer,
): TagChip[] {
  const chips: TagChip[] = [];
  let row = -1;
  let used = 0;
  for (const tag of tags) {
    const width = Math.min(
      innerWidth,
      measure(tag, TAG_CHIP.font) + 2 * TAG_CHIP.paddingX + TAG_CHIP.slack,
    );
    if (row < 0 || used + TAG_CHIP.gap + width > innerWidth) {
      row += 1;
      chips.push({ tag, row, x: 0, width });
    } else {
      chips.push({ tag, row, x: used + TAG_CHIP.gap, width });
    }
    used = (chips.at(-1)?.x ?? 0) + width;
  }
  return chips;
}

/** How many rows the chips wrap into across `innerWidth` px (0 without tags). */
export function tagRows(
  tags: readonly string[],
  innerWidth: number,
  measure: TextMeasurer,
): number {
  const last = tagChips(tags, innerWidth, measure).at(-1);
  return last === undefined ? 0 : last.row + 1;
}

let defaultMeasure: TextMeasurer | null = null;

/** The canvas text measurer in a browser; a fixed-width estimate where there is no canvas. */
export function textMeasurer(): TextMeasurer {
  defaultMeasure ??= canvasMeasurer() ?? fixedWidthMeasurer(0.55);
  return defaultMeasure;
}

/** The height of the tag block of a `cardWidth` px card (0 without tags); the gap above it is the card's. */
export function tagBlockHeight(
  tags: readonly string[] | undefined,
  cardWidth: number,
  measure: TextMeasurer = textMeasurer(),
): number {
  const shown = cardTags(tags);
  if (shown.length === 0) return 0;
  const rows = tagRows(shown, cardWidth - 2 * TAG_CHIP.cardPaddingX, measure);
  return rows * TAG_CHIP.height + (rows - 1) * TAG_CHIP.gap;
}
