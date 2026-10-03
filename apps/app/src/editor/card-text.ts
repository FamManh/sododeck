/**
 * How many lines a resized card's title and subtitle get (017 research R11): the card height
 * divided by each field's token line height. Always 1 title line, then 1 subtitle line as soon as
 * it fits (so a default-size card reads as it does today), then any further room goes to the
 * title. The same at every zoom level (§g-58). Never less than one title line, so a 44 px card
 * still truncates like today's fixed size.
 */
export interface TextLines {
  title: number;
  subtitle: number;
}

// Rounded from theme.css's --text-body-sm (12.5px × 1.45) and --text-node-sub (11px × 1.3).
const TITLE_LINE_HEIGHT = 18;
const SUBTITLE_LINE_HEIGHT = 12;

export function textLines(size: { width: number; height: number }): TextLines {
  const available = Math.max(0, size.height);
  // Always keep 1 title line; once there is room, guarantee 1 subtitle line too (so a default
  // card reads the same as today), then give any further room to the title, and only overflow
  // from a part-line of that growth back to the subtitle.
  let title = 1;
  let remaining = Math.max(0, available - TITLE_LINE_HEIGHT);
  let subtitle = 0;
  if (remaining >= SUBTITLE_LINE_HEIGHT) {
    subtitle = 1;
    remaining -= SUBTITLE_LINE_HEIGHT;
  }
  const extraTitleLines = Math.floor(remaining / TITLE_LINE_HEIGHT);
  title += extraTitleLines;
  remaining -= extraTitleLines * TITLE_LINE_HEIGHT;
  subtitle += Math.floor(remaining / SUBTITLE_LINE_HEIGHT);
  return { title, subtitle };
}
