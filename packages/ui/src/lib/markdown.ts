/**
 * The small markdown subset descriptions preview (008 research R3): paragraphs separated by blank
 * lines, one level of `-` / `*` / `+` bullets, and `` `code` ``. Everything else stays literal
 * text. Pure: the view renders the blocks as React elements, never as HTML.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; content: Inline[] }
  | { kind: 'em'; content: Inline[] };

export type Block = { kind: 'paragraph'; content: Inline[] } | { kind: 'list'; items: Inline[][] };

const BULLET = /^\s*[-*+]\s+(.*)$/;
const CODE = /`([^`]+)`/g;
const WORD = /[0-9A-Za-z]/;

function isWord(char: string | undefined): boolean {
  return char !== undefined && WORD.test(char);
}

function canOpen(text: string, index: number, marker: '*' | '_' | '**' | '__'): boolean {
  const before = text[index - 1];
  const after = text[index + marker.length];
  if (after === undefined || /\s/.test(after)) return false;
  if (marker.length === 1 && (before === marker || after === marker)) return false;
  if (marker.includes('_') && isWord(before)) return false;
  return true;
}

function canClose(text: string, index: number, marker: '*' | '_' | '**' | '__'): boolean {
  const before = text[index - 1];
  const after = text[index + marker.length];
  if (before === undefined || /\s/.test(before)) return false;
  if (marker.includes('_') && isWord(after)) return false;
  return true;
}

function pushText(out: Inline[], text: string): void {
  if (text.length === 0) return;
  const last = out.at(-1);
  if (last?.kind === 'text') last.text += text;
  else out.push({ kind: 'text', text });
}

function parseNestedAt(
  text: string,
  start: number,
  exclude?: '*' | '_' | '**' | '__',
): { kind: 'strong' | 'em'; content: Inline[]; end: number } | null {
  for (const marker of ['**', '__', '*', '_'] as const) {
    if (marker === exclude) continue;
    const nested = parseDelimited(text, start, marker);
    if (nested !== null) return nested;
  }
  return null;
}

function parseDelimited(
  text: string,
  start: number,
  marker: '*' | '_' | '**' | '__',
): { kind: 'strong' | 'em'; content: Inline[]; end: number } | null {
  if (text.slice(start, start + marker.length) !== marker || !canOpen(text, start, marker)) {
    return null;
  }
  const out: Inline[] = [];
  let cursor = start + marker.length;
  while (cursor < text.length) {
    if (text.slice(cursor, cursor + marker.length) === marker && canClose(text, cursor, marker)) {
      if (cursor === start + marker.length) return null;
      return {
        kind: marker.length === 2 ? 'strong' : 'em',
        content: out,
        end: cursor + marker.length,
      };
    }
    const nested = parseNestedAt(text, cursor, marker);
    if (nested !== null) {
      out.push({ kind: nested.kind, content: nested.content });
      cursor = nested.end;
      continue;
    }
    pushText(out, text[cursor] ?? '');
    cursor += 1;
  }
  return null;
}

function parseEmphasis(text: string): Inline[] {
  const out: Inline[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const nested = parseNestedAt(text, cursor);
    if (nested === null) {
      pushText(out, text[cursor] ?? '');
      cursor += 1;
      continue;
    }
    out.push({ kind: nested.kind, content: nested.content });
    cursor = nested.end;
  }
  return out;
}

function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of line.matchAll(CODE)) {
    if (match.index > last) out.push(...parseEmphasis(line.slice(last, match.index)));
    out.push({ kind: 'code', text: match[1] ?? '' });
    last = match.index + match[0].length;
  }
  if (last < line.length) out.push(...parseEmphasis(line.slice(last)));
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
