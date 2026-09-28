import { describe, expect, it } from 'vitest';

import { parseMarkdown } from '../src/lib/markdown';

const text = (t: string) => ({ kind: 'text', text: t }) as const;
const code = (t: string) => ({ kind: 'code', text: t }) as const;
const em = (...content: readonly ReturnType<typeof text | typeof code>[]) =>
  ({ kind: 'em', content }) as const;
const strong = (
  ...content: readonly (ReturnType<typeof text> | ReturnType<typeof code> | ReturnType<typeof em>)[]
) => ({ kind: 'strong', content }) as const;

describe('parseMarkdown (paragraphs, bullets, inline code)', () => {
  it('returns no blocks for empty or blank text', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('  \n \n')).toEqual([]);
  });

  it('splits paragraphs on blank lines and joins soft line breaks with a space', () => {
    expect(parseMarkdown('One\ntwo\n\n\nThree')).toEqual([
      { kind: 'paragraph', content: [text('One two')] },
      { kind: 'paragraph', content: [text('Three')] },
    ]);
  });

  it('reads -, * and + bullets at one level', () => {
    expect(parseMarkdown('Intro\n- a\n* b\n+   c')).toEqual([
      { kind: 'paragraph', content: [text('Intro')] },
      { kind: 'list', items: [[text('a')], [text('b')], [text('c')]] },
    ]);
  });

  it('starts a new paragraph after a list', () => {
    expect(parseMarkdown('- a\nafter')).toEqual([
      { kind: 'list', items: [[text('a')]] },
      { kind: 'paragraph', content: [text('after')] },
    ]);
  });

  it('reads inline code in paragraphs and bullets', () => {
    expect(parseMarkdown('Uses `Delivery tier` today.\n\n- `a` and `b`')).toEqual([
      { kind: 'paragraph', content: [text('Uses '), code('Delivery tier'), text(' today.')] },
      { kind: 'list', items: [[code('a'), text(' and '), code('b')]] },
    ]);
  });

  it('reads bold and italic, including bold wrapping italic', () => {
    expect(parseMarkdown('**b** __bb__ *i* _ii_ **bold *italic***')).toEqual([
      {
        kind: 'paragraph',
        content: [
          strong(text('b')),
          text(' '),
          strong(text('bb')),
          text(' '),
          em(text('i')),
          text(' '),
          em(text('ii')),
          text(' '),
          strong(text('bold '), em(text('italic'))),
        ],
      },
    ]);
  });

  it('keeps unmatched markers, markers next to spaces and snake_case literal', () => {
    expect(parseMarkdown('**open * open* *close _close snake_case_name')).toEqual([
      {
        kind: 'paragraph',
        content: [text('**open * open* *close _close snake_case_name')],
      },
    ]);
  });

  it('keeps everything else as literal text', () => {
    expect(parseMarkdown('<b>x</b> `open')).toEqual([
      { kind: 'paragraph', content: [text('<b>x</b> `open')] },
    ]);
    expect(parseMarkdown('-no space\n1. one')).toEqual([
      { kind: 'paragraph', content: [text('-no space 1. one')] },
    ]);
  });
});
