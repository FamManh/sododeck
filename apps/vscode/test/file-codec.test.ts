import { emptyDeckText, serializeDeck, toMarkdown } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { decode, describeProblems, encode, kindOf } from '../src/file-codec';

const deck = serializeDeck({
  ...emptySododeckFile(),
  name: 'Shop',
  nodes: [{ id: 'a', type: 'service', title: 'Orders' }],
});

describe('kindOf', () => {
  it('chooses the codec by the file name', () => {
    expect(kindOf('docs/Shop.sododeck.md')).toBe('markdown');
    expect(kindOf('docs/Shop.SODODECK.MD')).toBe('markdown');
    expect(kindOf('docs/test 2.md')).toBe('markdown');
    expect(kindOf('docs/Shop.sododeck')).toBe('plain');
  });
});

describe('plain', () => {
  it('passes the text through unchanged, whatever its formatting', () => {
    const odd = '{"version":1}';
    expect(decode('plain', odd)).toEqual({ ok: true, deckText: odd });
    expect(encode('plain', deck)).toBe(deck);
  });

  it('reads an empty or blank file as the empty deck', () => {
    expect(decode('plain', '')).toEqual({ ok: true, deckText: emptyDeckText() });
    expect(decode('plain', ' \n\t')).toEqual({ ok: true, deckText: emptyDeckText() });
  });
});

describe('markdown', () => {
  it('decodes through the model and encodes with the previous text', () => {
    const note = toMarkdown(deck);
    expect(decode('markdown', note)).toEqual({ ok: true, deckText: deck });
    const withOwn = `${note}\nmy own text\n`;
    expect(encode('markdown', deck, withOwn)).toBe(withOwn);
  });

  it('reads a marker-only note as the empty deck', () => {
    expect(decode('markdown', '---\nsododeck-plugin: parsed\n---\n')).toEqual({
      ok: true,
      deckText: emptyDeckText(),
    });
  });

  it('returns the problems of a note whose deck block cannot be read', () => {
    const result = decode(
      'markdown',
      '---\nsododeck-plugin: parsed\n---\n%% sododeck:begin %%\n%% sododeck:end %%\n',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]?.message).toMatch(/deck data/);
  });
});

describe('describeProblems', () => {
  it('joins every reason and says the file is untouched', () => {
    const text = describeProblems([
      { message: 'Cannot read the deck data.', fix: 'Fix the block.' },
      { message: 'Second.', fix: '' },
    ]);
    expect(text).toContain('Cannot read the deck data. Fix the block. Second.');
    expect(text).toContain('not been changed');
  });
});
