/**
 * The small markdown subset descriptions preview (008 research R3): paragraphs separated by blank
 * lines, one level of `-` / `*` / `+` bullets, and `` `code` ``. Everything else stays literal
 * text. Pure: the view renders the blocks as React elements, never as HTML.
 */

export type Inline = { kind: 'text'; text: string } | { kind: 'code'; text: string };

export type Block = { kind: 'paragraph'; content: Inline[] } | { kind: 'list'; items: Inline[][] };

const BULLET = /^\s*[-*+]\s+(.*)$/;
const CODE = /`([^`]+)`/g;

function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of line.matchAll(CODE)) {
    if (match.index > last) out.push({ kind: 'text', text: line.slice(last, match.index) });
    out.push({ kind: 'code', text: match[1] ?? '' });
    last = match.index + match[0].length;
  }
  if (last < line.length) out.push({ kind: 'text', text: line.slice(last) });
  return out;
}

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0)
      blocks.push({ kind: 'paragraph', content: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length > 0) blocks.push({ kind: 'list', items: list.map(parseInline) });
    list = [];
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const bullet = BULLET.exec(raw);
    if (line === '') {
      flushParagraph();
      flushList();
    } else if (bullet !== null) {
      flushParagraph();
      list.push((bullet[1] ?? '').trim());
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
