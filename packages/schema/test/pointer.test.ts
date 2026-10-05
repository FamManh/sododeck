import { describe, expect, it } from 'vitest';

import { comparePointers, fromPointer, toPointer } from '../src';

describe('toPointer', () => {
  it('is empty for the root', () => {
    expect(toPointer([])).toBe('');
  });

  it('joins segments with slashes', () => {
    expect(toPointer(['flows', 0, 'steps', 2, 'edge'])).toBe('/flows/0/steps/2/edge');
  });

  it('escapes ~ before /', () => {
    expect(toPointer(['tagColors', 'a/b~c'])).toBe('/tagColors/a~1b~0c');
    expect(toPointer(['x', '~1'])).toBe('/x/~01');
  });

  it('keeps empty and spaced keys', () => {
    expect(toPointer(['tagColors', ''])).toBe('/tagColors/');
    expect(toPointer(['tagColors', '  '])).toBe('/tagColors/  ');
  });
});

describe('comparePointers', () => {
  const sorted = (list: string[]) => [...list].sort(comparePointers);

  it('compares numeric segments numerically', () => {
    expect(sorted(['/nodes/10', '/nodes/2', '/nodes/1'])).toEqual([
      '/nodes/1',
      '/nodes/2',
      '/nodes/10',
    ]);
  });

  it('puts a parent before its children and the root first', () => {
    expect(sorted(['/nodes/1/title', '/nodes/1', ''])).toEqual(['', '/nodes/1', '/nodes/1/title']);
  });

  it('orders text segments by code unit and numbers before text', () => {
    expect(sorted(['/rules/b', '/rules/a', '/rules/10', '/rules/9'])).toEqual([
      '/rules/9',
      '/rules/10',
      '/rules/a',
      '/rules/b',
    ]);
  });

  it('orders top-level keys as files write them', () => {
    expect(sorted(['/assets/x', '/flows/0', '/version', '/nodes/3'])).toEqual([
      '/version',
      '/nodes/3',
      '/flows/0',
      '/assets/x',
    ]);
  });

  it('is 0 for equal pointers', () => {
    expect(comparePointers('/a/0', '/a/0')).toBe(0);
  });
});

describe('fromPointer', () => {
  it('reverses toPointer', () => {
    for (const segments of [[], ['a', '0', 'b'], ['tagColors', 'a/b~c'], ['x', '']]) {
      expect(fromPointer(toPointer(segments))).toEqual(segments);
    }
  });
});
