/**
 * Getting from raw text to the lines a parser reads: strips a BOM, a Markdown fence, front matter
 * and `%%` comments, keeping each line's original 1-based number so skipped lines can be reported
 * where the user sees them. Pure, no DOM.
 */
import { skippedLine, type SkippedLine } from './import-report';

export interface SourceLine {
  /** 1-based, in the text as given. */
  line: number;
  /** Not trimmed, so a parser can see indentation; never empty after trimming. */
  text: string;
}

export interface PreparedText {
  lines: SourceLine[];
  /** From the front matter's `title:`. */
  title?: string;
  /** One entry per diagram that was left out (`extra-diagram`). */
  extra: SkippedLine[];
}

export type DiagramType = 'flowchart' | 'sequence' | { unsupported: string } | 'none';

/** Diagram keywords Mermaid has that this importer does not read: named in the error message. */
const OTHER_KEYWORDS = new Set([
  'erdiagram',
  'classdiagram',
  'statediagram',
  'statediagram-v2',
  'gantt',
  'pie',
  'journey',
  'gitgraph',
  'mindmap',
  'timeline',
  'quadrantchart',
  'requirementdiagram',
  'c4context',
  'c4container',
  'c4component',
  'c4dynamic',
  'c4deployment',
  'sankey-beta',
  'xychart-beta',
  'block-beta',
  'packet-beta',
  'architecture-beta',
  'kanban',
  'radar-beta',
]);

const FENCE = /^\s*(```+|~~~+)/;

interface Block {
  lines: SourceLine[];
  opening: number;
}

function numbered(rawLines: readonly string[]): SourceLine[] {
  return rawLines.map((text, index) => ({ line: index + 1, text }));
}

function fencedBlocks(all: readonly SourceLine[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | undefined;
  let marker = '';
  for (const entry of all) {
    const fence = FENCE.exec(entry.text);
    if (current === undefined) {
      if (fence) {
        marker = fence[1]?.[0] ?? '`';
        current = { lines: [], opening: entry.line };
      }
    } else if (fence && fence[1]?.[0] === marker && entry.text.trim().length <= fence[1].length) {
      blocks.push(current);
      current = undefined;
    } else {
      current.lines.push(entry);
    }
  }
  // An unclosed fence still holds a diagram: take what is there.
  if (current !== undefined) blocks.push(current);
  return blocks;
}

function withoutNoise(lines: readonly SourceLine[]): { lines: SourceLine[]; title?: string } {
  let rest = lines.filter((l) => l.text.trim() !== '');
  let title: string | undefined;
  if (rest[0]?.text.trim() === '---') {
    const close = rest.findIndex((l, i) => i > 0 && l.text.trim() === '---');
    if (close > 0) {
      for (const entry of rest.slice(1, close)) {
        const match = /^\s*title\s*:\s*(.*)$/i.exec(entry.text);
        if (match?.[1] !== undefined && match[1].trim() !== '') {
          title = match[1].trim().replace(/^(["'])(.*)\1$/, '$2');
        }
      }
      rest = rest.slice(close + 1);
    }
  }
  const kept = rest.filter((l) => !l.text.trim().startsWith('%%'));
  return title === undefined ? { lines: kept } : { lines: kept, title };
}

/** First keyword of the first line, e.g. `flowchart` from `flowchart LR`. */
function firstWord(lines: readonly SourceLine[]): string {
  return /^[A-Za-z][\w-]*/.exec(lines[0]?.text.trim() ?? '')?.[0] ?? '';
}

export function diagramType(lines: readonly SourceLine[]): DiagramType {
  const word = firstWord(lines);
  const lower = word.toLowerCase();
  if (lower === 'flowchart' || lower === 'graph') return 'flowchart';
  if (word === 'sequenceDiagram') return 'sequence';
  if (OTHER_KEYWORDS.has(lower)) return { unsupported: word };
  return 'none';
}

/** Cleans `text` into the lines of the one diagram to import. */
export function prepare(text: string): PreparedText {
  const all = numbered(
    text
      .slice(text.charCodeAt(0) === 0xfeff ? 1 : 0)
      .replace(/\r\n?/g, '\n')
      .split('\n'),
  );
  const blocks = fencedBlocks(all);
  if (blocks.length === 0) {
    return { ...withoutNoise(all), extra: [] };
  }
  const cleaned = blocks.map((block) => ({ block, ...withoutNoise(block.lines) }));
  const chosen =
    cleaned.find((c) => {
      const type = diagramType(c.lines);
      return type === 'flowchart' || type === 'sequence';
    }) ?? cleaned[0];
  const extra: SkippedLine[] = [];
  for (const other of cleaned) {
    if (other === chosen || other.lines.length === 0) continue;
    const first = other.lines[0];
    extra.push(skippedLine(first?.line ?? other.block.opening, first?.text ?? '', 'extra-diagram'));
  }
  const lines = chosen?.lines ?? [];
  return chosen?.title === undefined ? { lines, extra } : { lines, title: chosen.title, extra };
}
