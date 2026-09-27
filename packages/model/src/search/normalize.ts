import type { Range } from './search';

interface NormalizedText {
  norm: string;
  /** One raw-string index per normalized character. */
  map: number[];
}

const MARKERS = new Set(['*', '_', '`']);
const LINE_MARKERS = new Set(['-', '#', '>']);

function isCombiningMark(char: string): boolean {
  return /\p{M}/u.test(char);
}

function isWhitespace(char: string): boolean {
  return /\s/u.test(char);
}

function pushSpace(state: { text: string[]; map: number[] }, rawIndex: number): void {
  if (state.text.length === 0 || state.text.at(-1) === ' ') return;
  state.text.push(' ');
  state.map.push(rawIndex);
}

function normalizeDetailed(text: string): NormalizedText {
  const out = { text: [] as string[], map: [] as number[] };
  let lineStart = true;
  let skippingPrefixSpace = false;

  for (let i = 0; i < text.length; i++) {
    const raw = text[i];
    if (raw === undefined || raw === '\r') continue;
    if (raw === '\n') {
      pushSpace(out, i);
      lineStart = true;
      skippingPrefixSpace = false;
      continue;
    }
    if (lineStart) {
      if (isWhitespace(raw)) continue;
      if (LINE_MARKERS.has(raw)) {
        skippingPrefixSpace = true;
        continue;
      }
      lineStart = false;
    }
    if (skippingPrefixSpace && isWhitespace(raw)) continue;
    skippingPrefixSpace = false;

    for (const char of raw.normalize('NFKD')) {
      if (isCombiningMark(char) || MARKERS.has(char)) continue;
      const lowered = char.toLowerCase();
      if (isWhitespace(lowered)) pushSpace(out, i);
      else {
        out.text.push(lowered);
        out.map.push(i);
      }
    }
  }

  while (out.text.at(-1) === ' ') {
    out.text.pop();
    out.map.pop();
  }
  return { norm: out.text.join(''), map: out.map };
}

export function normalizeText(text: string): string {
  return normalizeDetailed(text).norm;
}

function endOfRawRange(raw: string, start: number, length: number): number {
  let index = start;
  let remaining = length;
  while (remaining > 0 && index < raw.length) {
    index += raw[index]?.length ?? 1;
    remaining--;
  }
  return index;
}

export function rawRanges(text: string, words: readonly string[]): readonly Range[] {
  if (words.length === 0) return [];
  const normalized = normalizeDetailed(text);
  const ranges: Range[] = [];
  for (const word of words) {
    const at = normalized.norm.indexOf(word);
    if (at === -1) continue;
    const start = normalized.map[at];
    const endStart = normalized.map[at + word.length - 1];
    if (start === undefined || endStart === undefined) continue;
    ranges.push({ start, end: endOfRawRange(text, endStart, 1) });
  }
  return ranges.sort((a, b) => a.start - b.start);
}

export function rawSnippet(
  text: string,
  words: readonly string[],
  width = 80,
): { text: string; ranges: readonly Range[] } | undefined {
  const normalized = normalizeDetailed(text);
  const starts = words
    .map((word) => normalized.norm.indexOf(word))
    .filter((at) => at !== -1)
    .sort((a, b) => a - b);
  const matchAt = starts[0];
  if (matchAt === undefined) return undefined;
  const rawAt = normalized.map[matchAt];
  if (rawAt === undefined) return undefined;
  const half = Math.floor(width / 2);
  const rawStart = Math.max(0, rawAt - half);
  const rawEnd = Math.min(text.length, rawStart + width);
  const body = text.slice(rawStart, rawEnd).trim();
  const prefix = rawStart > 0 ? '…' : '';
  const suffix = rawEnd < text.length ? '…' : '';
  const visibleStart = text.indexOf(body, rawStart);
  const snippet = `${prefix}${body}${suffix}`;
  const ranges = rawRanges(text, words)
    .filter((range) => range.start >= visibleStart && range.end <= visibleStart + body.length)
    .map((range) => ({
      start: prefix.length + range.start - visibleStart,
      end: prefix.length + range.end - visibleStart,
    }));
  return { text: snippet, ranges };
}
