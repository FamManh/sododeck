import { describe, expect, it } from 'vitest';

import { shouldSwap, shouldSwapBack } from '../src/md-swap';

const base = { viewType: 'markdown', extension: 'md', hasMarker: true, leafState: {} };

describe('shouldSwap', () => {
  it('swaps the Markdown view of a deck note', () => {
    expect(shouldSwap(base)).toBe(true);
  });
  it('leaves ordinary notes and other views alone', () => {
    expect(shouldSwap({ ...base, hasMarker: false })).toBe(false);
    expect(shouldSwap({ ...base, viewType: 'canvas' })).toBe(false);
    expect(shouldSwap({ ...base, viewType: 'sododeck' })).toBe(false);
    expect(shouldSwap({ ...base, extension: 'txt' })).toBe(false);
    expect(shouldSwap({ ...base, extension: null })).toBe(false);
  });
  it('respects the opt-out flag on the leaf', () => {
    expect(shouldSwap({ ...base, leafState: { sododeckSource: true } })).toBe(false);
    expect(shouldSwap({ ...base, leafState: { sododeckSource: false } })).toBe(true);
  });
});

describe('shouldSwapBack', () => {
  it('returns a deck view of a note that lost its marker to Markdown', () => {
    expect(shouldSwapBack({ viewType: 'sododeck', extension: 'md', hasMarker: false })).toBe(true);
    expect(shouldSwapBack({ viewType: 'sododeck', extension: 'md', hasMarker: true })).toBe(false);
    expect(shouldSwapBack({ viewType: 'sododeck', extension: 'sododeck', hasMarker: false })).toBe(
      false,
    );
    expect(shouldSwapBack({ viewType: 'markdown', extension: 'md', hasMarker: false })).toBe(false);
  });
});
