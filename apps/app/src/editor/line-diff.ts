/**
 * Minimal text updates for the JSON viewer (004 research R2): the panel never calls Monaco's
 * `setValue` after the first load, so folds and scroll outside the changed lines are kept.
 */

/** The old lines `startLine..endLine` (1-based, inclusive; empty when `endLine < startLine`) become `lines`. */
export interface LineDiff {
  startLine: number;
  endLine: number;
  lines: readonly string[];
}

/** Monaco's `IIdentifiedSingleEditOperation` shape, without importing Monaco. */
export interface RangeEdit {
  range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
  text: string;
}

/** Monaco clamps a column past the end of a line to the line's end. */
const LINE_END = Number.MAX_SAFE_INTEGER;

/** One replace of the lines between the common leading and trailing lines; `null` when equal. */
export function lineDiff(oldText: string, newText: string): LineDiff | null {
  if (oldText === newText) return null;
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const max = Math.min(a.length, b.length);
  let head = 0;
  while (head < max && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < max - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  return { startLine: head + 1, endLine: a.length - tail, lines: b.slice(head, b.length - tail) };
}

function range(startLine: number, startColumn: number, endLine: number, endColumn: number) {
  return {
    startLineNumber: startLine,
    startColumn,
    endLineNumber: endLine,
    endColumn,
  };
}

/** The diff as one Monaco edit on a model that has `oldLineCount` lines. */
export function toRangeEdit(diff: LineDiff, oldLineCount: number): RangeEdit {
  const { startLine, endLine, lines } = diff;
  const text = lines.join('\n');
  if (endLine < startLine) {
    // Pure insertion before `startLine`, or after the last line.
    return startLine <= oldLineCount
      ? { range: range(startLine, 1, startLine, 1), text: `${text}\n` }
      : { range: range(oldLineCount, LINE_END, oldLineCount, LINE_END), text: `\n${text}` };
  }
  if (lines.length > 0) return { range: range(startLine, 1, endLine, LINE_END), text };
  // Pure deletion: also remove one line break, the following one if there is a next line.
  if (endLine < oldLineCount) return { range: range(startLine, 1, endLine + 1, 1), text: '' };
  return { range: range(startLine - 1, LINE_END, endLine, LINE_END), text: '' };
}
