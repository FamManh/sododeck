import { describe, expect, it } from 'vitest';

import { importMessage, kindOfText } from './use-import-files';

const note = (front: string, body = '') => `---\n${front}\n---\n${body}`;

describe('kindOfText (070)', () => {
  it('tells a deck note from an ordinary note by its front matter marker', () => {
    expect(kindOfText(note('sododeck-plugin: parsed', '# Shop'))).toBe('deck-md');
    expect(kindOfText(note('tags: [a]', '# Shop'))).toBe('unknown');
    expect(kindOfText('# Just a note\n')).toBe('unknown');
  });

  it('still reads JSON as a deck and a diagram as Mermaid', () => {
    expect(kindOfText('{"version":1}')).toBe('deck');
    expect(kindOfText('\uFEFF {"version":1}')).toBe('deck');
    expect(kindOfText('flowchart TD\n  a --> b\n')).toBe('mermaid');
  });

  it('names .sododeck.md in the refusal message', () => {
    expect(importMessage(new Error('x'))).toContain('.sododeck.md');
  });
});
