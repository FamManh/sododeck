import { describe, expect, it } from 'vitest';

import { lineDiff, toRangeEdit, type RangeEdit } from './line-diff';

/**
 * Applies a Monaco-shaped edit to a text, the way `model.applyEdits` would: columns past the end
 * of a line are clamped to it (Monaco validates every range first).
 */
function apply(text: string, edit: RangeEdit): string {
  const lines = text.split('\n');
  const offset = (line: number, column: number) =>
    lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0) +
    Math.min(column, (lines[line - 1] ?? '').length + 1) -
    1;
  const { startLineNumber, startColumn, endLineNumber, endColumn } = edit.range;
  return (
    text.slice(0, offset(startLineNumber, startColumn)) +
    edit.text +
    text.slice(offset(endLineNumber, endColumn))
  );
}

function roundTrip(oldText: string, newText: string): string {
  const diff = lineDiff(oldText, newText);
  if (diff === null) return oldText;
  return apply(oldText, toRangeEdit(diff, oldText.split('\n').length));
}

describe('lineDiff', () => {
  it('is null for equal texts', () => {
    expect(lineDiff('a\nb', 'a\nb')).toBeNull();
  });

  it('keeps only the changed middle lines', () => {
    expect(lineDiff('a\nb\nc\nd', 'a\nB\nC\nd')).toEqual({
      startLine: 2,
      endLine: 3,
      lines: ['B', 'C'],
    });
  });

  it('tells zero new lines from one empty line', () => {
    expect(lineDiff('a\nb\nc', 'a\nc')).toEqual({ startLine: 2, endLine: 2, lines: [] });
    expect(lineDiff('a\nb\nc', 'a\n\nc')).toEqual({ startLine: 2, endLine: 2, lines: [''] });
  });

  it.each([
    ['a pure insertion', 'a\nd', 'a\nb\nc\nd'],
    ['a pure deletion', 'a\nb\nc\nd', 'a\nd'],
    ['an edit at the start', 'a\nb\nc', 'x\nb\nc'],
    ['an edit at the end', 'a\nb\nc', 'a\nb\nx'],
    ['an insertion at the start', 'b\nc', 'a\nb\nc'],
    ['an insertion at the end', 'a\nb', 'a\nb\nc'],
    ['a deletion at the start', 'a\nb\nc', 'b\nc'],
    ['a deletion at the end', 'a\nb\nc', 'a\nb'],
    ['a trailing newline added', 'a\nb', 'a\nb\n'],
    ['a trailing newline removed', 'a\nb\n', 'a\nb'],
    ['from empty', '', 'a\nb'],
    ['to empty', 'a\nb', ''],
    ['everything replaced', 'a\nb', 'x\ny\nz'],
    ['a line emptied', 'a\nb\nc', 'a\n\nc'],
    ['a middle line removed', 'a\nb\nc', 'a\nc'],
  ])('handles %s', (_, oldText, newText) => {
    expect(roundTrip(oldText, newText)).toBe(newText);
  });

  it('turns any random line edit into an edit that yields the new text', () => {
    // Seeded LCG so failures reproduce.
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 2 ** 32;
      return seed / 2 ** 32;
    };
    const int = (n: number) => Math.floor(random() * n);
    const base = Array.from({ length: 50 }, (_, i) => `line ${String(i)}`);
    for (let run = 0; run < 200; run++) {
      const lines = [...base];
      const at = int(lines.length + 1);
      const remove = int(5);
      const insert = Array.from({ length: int(5) }, () => `new ${String(int(1000))}`);
      lines.splice(at, remove, ...insert);
      const oldText = base.join('\n');
      const newText = lines.join('\n');
      expect(roundTrip(oldText, newText)).toBe(newText);
    }
  });
});
