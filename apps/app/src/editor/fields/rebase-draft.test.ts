import { describe, expect, it } from 'vitest';

import { rebaseCaret, rebaseDraft } from './rebase-draft';

describe('rebaseDraft (036 R7)', () => {
  it('applies an outside insert before the local edit', () => {
    expect(rebaseDraft('Hello world', 'Oh, Hello world', 'Hello big world')).toBe(
      'Oh, Hello big world',
    );
  });

  it('applies an outside insert after the local edit', () => {
    expect(rebaseDraft('Hello world', 'Hello world!', 'Hello big world')).toBe('Hello big world!');
  });

  it('keeps both texts when the outside insert lands inside the local edit', () => {
    // Local: "world" → "there"; outside: "wo" + "nderful wo" + "rld".
    expect(rebaseDraft('Hello world', 'Hello wonderful world', 'Hello there')).toBe(
      'Hello therenderful wo',
    );
  });

  it('puts an outside insert at the same point before the local one', () => {
    expect(rebaseDraft('Hi', 'Hi theirs', 'Hi mine')).toBe('Hi theirs mine');
  });

  it('applies an outside delete', () => {
    expect(rebaseDraft('One two three', 'One three', 'One two three four')).toBe('One three four');
    // A delete around a local insert removes the deleted text and keeps the insert.
    expect(rebaseDraft('abcdef', 'af', 'abcXdef')).toBe('aXf');
  });

  it('returns the draft for identical texts, and theirs when nothing was typed', () => {
    expect(rebaseDraft('Same', 'Same', 'Same typed')).toBe('Same typed');
    expect(rebaseDraft('Base', 'Base changed', 'Base')).toBe('Base changed');
  });

  it('keeps trailing spaces the document does not have', () => {
    expect(rebaseDraft('Hello', 'Hello there', 'Hello  ')).toBe('Hello there  ');
  });
});

describe('rebaseCaret', () => {
  it('shifts a caret after the outside change and keeps one before it', () => {
    // Caret after "big " in the draft; the outside text lands before it.
    expect(rebaseCaret('Hello world', 'Oh, Hello world', 'Hello big world', 10)).toBe(14);
    // Outside text after the caret: the caret stays.
    expect(rebaseCaret('Hello world', 'Hello world!', 'Hello big world', 10)).toBe(10);
  });

  it('keeps the caret after the user’s last typed character', () => {
    // The user typed "  " after "Hello"; the outside " there" goes before it.
    expect(rebaseCaret('Hello', 'Hello there', 'Hello  ', 7)).toBe(13);
    expect(rebaseCaret('Hi', 'Hi theirs', 'Hi mine', 7)).toBe(14);
  });

  it('moves a caret inside outside-deleted text to the end of the change', () => {
    // "One t|wo three" → "One three": the change is "wo t" after "One t", so the caret goes to 5.
    expect(rebaseCaret('One two three', 'One three', 'One two three', 6)).toBe(5);
  });
});
