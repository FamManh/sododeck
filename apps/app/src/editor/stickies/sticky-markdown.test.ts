import { describe, expect, it } from 'vitest';

import { linkRange, toggleBold } from './sticky-markdown';

describe('toggleBold', () => {
  it('wraps the range and keeps it selected', () => {
    expect(toggleBold('hello world', 0, 5)).toEqual({ text: '**hello** world', start: 2, end: 7 });
  });

  it('unwraps a range that holds its own markers', () => {
    expect(toggleBold('**hello**', 0, 9)).toEqual({ text: 'hello', start: 0, end: 5 });
  });

  it('unwraps a range whose markers sit just outside it', () => {
    expect(toggleBold('**hello** world', 2, 7)).toEqual({ text: 'hello world', start: 0, end: 5 });
  });

  it('does nothing for an empty range or text', () => {
    expect(toggleBold('abc', 1, 1).text).toBe('abc');
    expect(toggleBold('', 0, 0).text).toBe('');
  });

  it('accepts a reversed range', () => {
    expect(toggleBold('hello world', 5, 0).text).toBe('**hello** world');
  });
});

describe('linkRange', () => {
  it('links the range and selects the placeholder address', () => {
    const edit = linkRange('hello world', 6, 11);
    expect(edit.text).toBe('hello [world](https://)');
    expect(edit.text.slice(edit.start, edit.end)).toBe('https://');
  });

  it('does nothing for an empty range', () => {
    expect(linkRange('abc', 2, 2).text).toBe('abc');
  });
});
