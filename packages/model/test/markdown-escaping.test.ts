import { describe, expect, it } from 'vitest';

import { fromMarkdown, toMarkdown } from '../src/markdown-form';
import { richDeck, textOf } from './markdown-helpers';

function roundTrip(prose: string, title = prose): { deckText: string; edited: boolean } {
  const deck = {
    ...richDeck(),
    description: prose,
    nodes: [
      {
        id: 'web',
        type: 'client',
        title: title || 'x',
        description: prose,
        position: { x: 0, y: 0 },
      },
    ],
    edges: [],
    groups: [],
    flows: [],
    rules: {},
    stickies: [{ id: 's1', text: prose || 'x', position: { x: 0, y: 0 } }],
    features: [],
    views: [],
  };
  const text = textOf(deck);
  const back = fromMarkdown(toMarkdown(text));
  if (!back.ok) throw new Error('unreadable');
  expect(back.deckText).toBe(text);
  return back;
}

describe('escaping table', () => {
  const samples = [
    '50%% off',
    '%%',
    '%%%',
    '%&#37;',
    '&#37;',
    '&amp;#37;',
    '&lt;br>',
    '<br>',
    'a<br>b',
    '# heading',
    '  # indented',
    '\\# already escaped',
    '\\\\# two',
    'line\n# heading\nmore',
    '%% sododeck:end %%',
    '%% sododeck:data',
    '%%id%%',
    '%%id:field%%',
    '```',
    '````json',
    '- [[x]] %%' + 'a'.repeat(64) + '%%',
    'ends with %',
    '% starts',
    '  trailing  ',
    '\n\nlead',
    'tail\n\n',
    'ünï 😀',
  ];
  for (const s of samples) {
    it(`round-trips ${JSON.stringify(s)}`, () => {
      roundTrip(s, s.replace(/\n/g, ' '));
    });
  }

  it('a body that holds a region-closing line cannot close the region', () => {
    const md = toMarkdown(textOf({ ...richDeck(), description: 'x\n%% sododeck:end %%\ny' }));
    expect(md.match(/^%% sododeck:end %%$/gm)).toHaveLength(1);
  });

  it('writes a line break in a title as <br> and one heading line', () => {
    const md = toMarkdown(textOf({ ...richDeck(), name: 'one\ntwo' }));
    expect(md).toContain('# one<br>two %%deck%%');
  });

  it('writes a body line starting with # with a backslash', () => {
    const md = toMarkdown(textOf({ ...richDeck(), description: '# x' }));
    expect(md).toContain('%%deck:description%%\n\\# x');
  });
});

describe('property: any prose string survives', () => {
  const alphabet = [
    'a',
    'Z',
    ' ',
    '%',
    '%',
    '#',
    '\\',
    '`',
    '<br>',
    '&#37;',
    '&amp;',
    '&lt;br>',
    '\n',
    'é',
    '😀',
    '-',
    '[',
    ']',
    ':',
  ];
  function rng(seed: number): () => number {
    let s = seed;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  }
  it('1000 generated strings', () => {
    const rand = rng(42);
    for (let i = 0; i < 1000; i++) {
      const length = Math.floor(rand() * 14);
      let s = '';
      for (let j = 0; j < length; j++) s += alphabet[Math.floor(rand() * alphabet.length)] ?? '';
      roundTrip(s, s.replace(/\n/g, ' ').trim() === '' ? 'x' : s.replace(/\n/g, ' '));
    }
  });
});
