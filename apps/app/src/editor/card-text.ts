/**
 * How many lines a resized card's title and subtitle get (017 research R11): available height is
 * the card height minus a fixed reserve (padding, and for the full/component layout the kind-tile
 * row it shares with the title), divided by each field's token line height. Always 1 title line,
 * then 1 subtitle line as soon as it fits (so a default-size card reads as it does today), then
 * any further room goes to the title; the compact layout (every other level) has no kind-tile
 * reserve. Never less than one title line, so a 44 px card still truncates like today's fixed size.
 */
import type { Level } from './levels';

export interface TextLines {
  title: number;
  subtitle: number;
}

// Rounded from theme.css's --text-body-sm (12.5px × 1.45) and --text-node-sub (11px × 1.3).
const TITLE_LINE_HEIGHT = 18;
const SUBTITLE_LINE_HEIGHT = 12;
// py-2 (16px) plus the room the kind tile's row claims before the title can use it.
const FULL_RESERVED = 30;

export function textLines(size: { width: number; height: number }, level: Level): TextLines {
  const reserved = level === 'component' ? FULL_RESERVED : 0;
  const available = Math.max(0, size.height - reserved);
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
