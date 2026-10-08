/**
 * Recognising a `.sododeck.md` note (070): the front matter marker. Kept apart from
 * `markdown-form.ts` (and importable as `@sododeck/model/markdown-marker`) so code that only has to
 * tell a deck note from any other text, such as the library route's import, loads no schema.
 */
export const MARKER_KEY = 'sododeck-plugin';
export const MARKER_VALUE = 'parsed';

const FRONT = /^(\uFEFF?)---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
export const MARKER_LINE = new RegExp(
  `^${MARKER_KEY}:[ \\t]*["']?${MARKER_VALUE}["']?[ \\t]*$`,
  'm',
);

export function frontOf(text: string): { raw: string; block: string } | null {
  const match = FRONT.exec(text);
  return match === null ? null : { raw: match[0], block: match[2] ?? '' };
}

/** True when text starts with front matter that carries the marker. Cheap; used before any parse. */
export function isDeckMarkdown(text: string): boolean {
  const front = frontOf(text.slice(0, 20_000));
  return front !== null && MARKER_LINE.test(front.block);
}
