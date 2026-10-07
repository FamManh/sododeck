import { describe, expect, it } from 'vitest';

import { redirectViewState, shouldSwap, shouldSwapBack } from '../src/md-swap';

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

describe('redirectViewState (no flash)', () => {
  const marked = (p: string) => p === 'deck.md';
  it('opens a deck note straight in the deck view', () => {
    expect(
      redirectViewState({ type: 'markdown', state: { file: 'deck.md', mode: 'source' } }, marked),
    ).toEqual({
      type: 'sododeck',
      state: { file: 'deck.md', mode: 'source' },
    });
  });
  it('leaves other notes, other views and the opt-out alone', () => {
    const plain = { type: 'markdown', state: { file: 'note.md' } };
    expect(redirectViewState(plain, marked)).toBe(plain);
    const other = { type: 'canvas', state: { file: 'deck.md' } };
    expect(redirectViewState(other, marked)).toBe(other);
    const source = { type: 'markdown', state: { file: 'deck.md', sododeckSource: true } };
    expect(redirectViewState(source, marked)).toBe(source);
    const none = { type: 'markdown' };
    expect(redirectViewState(none, marked)).toBe(none);
  });
});
