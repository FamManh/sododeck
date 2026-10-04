import { describe, expect, it } from 'vitest';

import { neighbour } from './grid-nav';

const rows = [
  ['a', 'b', 'c', 'd', 'e'],
  ['f', 'g'],
  ['h', 'i', 'j'],
];

describe('neighbour', () => {
  it('moves left and right across rows of the flat list', () => {
    expect(neighbour(rows, 'c', 'ArrowRight', 3)).toBe('d');
    expect(neighbour(rows, 'e', 'ArrowRight', 3)).toBe('f');
    expect(neighbour(rows, 'f', 'ArrowLeft', 3)).toBe('e');
    expect(neighbour(rows, 'a', 'ArrowLeft', 3)).toBeNull();
    expect(neighbour(rows, 'j', 'ArrowRight', 3)).toBeNull();
  });

  it('moves down inside a section and into the next one, clamping a short row', () => {
    expect(neighbour(rows, 'a', 'ArrowDown', 3)).toBe('d');
    expect(neighbour(rows, 'c', 'ArrowDown', 3)).toBe('g');
    expect(neighbour(rows, 'g', 'ArrowDown', 3)).toBe('i');
    expect(neighbour(rows, 'j', 'ArrowDown', 3)).toBeNull();
  });

  it('moves up inside a section and into the last row of the previous one', () => {
    expect(neighbour(rows, 'd', 'ArrowUp', 3)).toBe('a');
    expect(neighbour(rows, 'i', 'ArrowUp', 3)).toBe('g');
    expect(neighbour(rows, 'f', 'ArrowUp', 3)).toBe('d');
    expect(neighbour(rows, 'a', 'ArrowUp', 3)).toBeNull();
  });

  it('returns null for an unknown id or key', () => {
    expect(neighbour(rows, 'zz', 'ArrowUp', 3)).toBeNull();
    expect(neighbour(rows, 'a', 'Home', 3)).toBeNull();
  });
});
