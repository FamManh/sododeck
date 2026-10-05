/**
 * Bold and link for a note's markdown text (053 R11): pure edits of a string and a selection, so
 * the toolbar can apply them to the textarea's selection while editing and to the whole text
 * otherwise. No rich-text format: the note stays plain markdown.
 */

export interface MarkdownEdit {
  text: string;
  /** Where the selection should sit afterwards. */
  start: number;
  end: number;
}

const BOLD = '**';
/** What a new link points at: selected afterwards, so typing replaces it. */
export const LINK_PLACEHOLDER = 'https://';

/**
 * Bolds the range, or removes the bold when the range is already bold (its own markers inside it,
 * or markers right outside it). An empty range changes nothing.
 */
export function toggleBold(text: string, start: number, end: number): MarkdownEdit {
  const from = Math.max(0, Math.min(start, end));
  const to = Math.min(text.length, Math.max(start, end));
  const selected = text.slice(from, to);
  if (selected === '') return { text, start: from, end: to };
  if (
    selected.length >= 2 * BOLD.length + 1 &&
    selected.startsWith(BOLD) &&
    selected.endsWith(BOLD)
  ) {
    const inner = selected.slice(BOLD.length, -BOLD.length);
    return {
      text: text.slice(0, from) + inner + text.slice(to),
      start: from,
      end: from + inner.length,
    };
  }
  if (text.slice(from - BOLD.length, from) === BOLD && text.slice(to, to + BOLD.length) === BOLD) {
    return {
      text: text.slice(0, from - BOLD.length) + selected + text.slice(to + BOLD.length),
      start: from - BOLD.length,
      end: from - BOLD.length + selected.length,
    };
  }
  return {
    text: `${text.slice(0, from)}${BOLD}${selected}${BOLD}${text.slice(to)}`,
    start: from + BOLD.length,
    end: to + BOLD.length,
  };
}

/** Turns the range into a link with a placeholder address, which ends up selected. */
export function linkRange(text: string, start: number, end: number): MarkdownEdit {
  const from = Math.max(0, Math.min(start, end));
  const to = Math.min(text.length, Math.max(start, end));
  const selected = text.slice(from, to);
  if (selected === '') return { text, start: from, end: to };
  const head = `${text.slice(0, from)}[${selected}](`;
  return {
    text: `${head}${LINK_PLACEHOLDER})${text.slice(to)}`,
    start: head.length,
    end: head.length + LINK_PLACEHOLDER.length,
  };
}
