/**
 * How many lines a resized card's title and subtitle get (017 research R11): available height is
 * the card height minus a fixed reserve (padding, and for the full/component layout the kind-tile
 * row it shares with the title), divided by each field's token line height. The full layout gives
 * the title priority and fits a subtitle in whatever remains; the compact layout (every other
 * level) has no kind-tile reserve. Never less than one title line, so a 44 px card still truncates
 * like today's fixed size.
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
  const available = size.height - reserved;
  const title = Math.max(1, Math.floor(available / TITLE_LINE_HEIGHT));
  const remaining = Math.max(0, available - title * TITLE_LINE_HEIGHT);
  const subtitle = Math.max(0, Math.floor(remaining / SUBTITLE_LINE_HEIGHT));
  return { title, subtitle };
}
