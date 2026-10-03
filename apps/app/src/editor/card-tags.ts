/**
 * Tags shown on a card (founder, 2026-10-03): up to ten chips that wrap under the title, and the
 * card grows to fit them. The height is computed here, not measured in the DOM, so `cardSize`
 * (and with it edges, group frames, layout and export) agrees with what the card draws; zooming
 * never changes it.
 */
import { canvasMeasurer, fixedWidthMeasurer, type TextMeasurer } from './export/text-measure';

export const MAX_CARD_TAGS = 10;

/** The on-card chip (`deck-node.tsx`'s `CardTag`): h-5, px-2, gap-1, text-caption. */
export const TAG_CHIP = {
  height: 20,
  gap: 4,
  paddingX: 8,
  /** Under the last row (pb-2). */
  paddingBottom: 8,
  /** The card's px-2.5 on each side. */
  cardPaddingX: 10,
  font: "11.5px 'Geist Variable', system-ui, sans-serif",
  /** Slack per chip, for a font still loading or sub-pixel rounding: never wrap later than CSS. */
  slack: 2,
} as const;

/** The tags a card shows: the first ten, older decks may hold more. */
export function cardTags(tags: readonly string[] | undefined): readonly string[] {
  return (tags ?? []).slice(0, MAX_CARD_TAGS);
}

/** How many rows the chips wrap into across `innerWidth` px (0 without tags). */
export function tagRows(
  tags: readonly string[],
  innerWidth: number,
  measure: TextMeasurer,
): number {
  let rows = 0;
  let used = 0;
  for (const tag of tags) {
    const chip = Math.min(
      innerWidth,
      measure(tag, TAG_CHIP.font) + 2 * TAG_CHIP.paddingX + TAG_CHIP.slack,
    );
    if (rows === 0 || used + TAG_CHIP.gap + chip > innerWidth) {
      rows += 1;
      used = chip;
    } else {
      used += TAG_CHIP.gap + chip;
    }
  }
  return rows;
}

let defaultMeasure: TextMeasurer | null = null;

/** The canvas text measurer in a browser; a fixed-width estimate where there is no canvas. */
function measurer(): TextMeasurer {
  defaultMeasure ??= canvasMeasurer() ?? fixedWidthMeasurer(0.55);
  return defaultMeasure;
}

/** The height the tag block adds under the title row of a `cardWidth` px card (0 without tags). */
export function tagBlockHeight(
  tags: readonly string[] | undefined,
  cardWidth: number,
  measure: TextMeasurer = measurer(),
): number {
  const shown = cardTags(tags);
  if (shown.length === 0) return 0;
  const rows = tagRows(shown, cardWidth - 2 * TAG_CHIP.cardPaddingX, measure);
  return rows * TAG_CHIP.height + (rows - 1) * TAG_CHIP.gap + TAG_CHIP.paddingBottom;
}
