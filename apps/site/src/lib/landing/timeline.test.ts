import { describe, expect, it } from 'vitest';

import { animate, fadeIn, hashName, keyframesBody, Timeline, withAnimation } from './timeline';

describe('keyframesBody', () => {
  it('turns seconds into percents and holds the first and last key', () => {
    expect(
      keyframesBody(
        [
          [2, { opacity: 0 }],
          [4, { opacity: 1 }],
        ],
        10,
      ),
    ).toBe('0%{opacity:0}20.000%{opacity:0}40.000%{opacity:1}100%{opacity:1}');
  });

  it('kebab-cases properties and keeps per-key timing functions', () => {
    expect(
      keyframesBody(
        [
          [0, { strokeDashoffset: 1 }, 'steps(3,end)'],
          [5, { strokeDashoffset: 0 }],
        ],
        5,
      ),
    ).toBe(
      '0.000%{stroke-dashoffset:1;animation-timing-function:steps(3,end)}100.000%{stroke-dashoffset:0}',
    );
  });

  it('clamps keys past the end and is empty without keys', () => {
    expect(keyframesBody([[12, { opacity: 1 }]], 10)).toBe('0%{opacity:1}100.000%{opacity:1}');
    expect(keyframesBody([], 10)).toBe('');
  });
});

describe('hashName', () => {
  it('is stable and differs for different bodies', () => {
    expect(hashName('a')).toBe(hashName('a'));
    expect(hashName('a')).not.toBe(hashName('b'));
    expect(hashName('a')).toMatch(/^sdl-[0-9a-z]+$/);
  });
});

describe('Timeline', () => {
  it('returns the gated animation and emits each keyframes rule once', () => {
    const tl = new Timeline(10, true);
    const a = tl.animate([
      [1, { opacity: 0 }],
      [2, { opacity: 1 }],
    ]);
    const b = tl.animate([
      [1, { opacity: 0 }],
      [2, { opacity: 1 }],
    ]);
    expect(a).toEqual(b);
    expect(a.className).toBe('sdl-a');
    expect((a.style as Record<string, string>)['--sdl-a']).toMatch(
      /^sdl-[0-9a-z]+ 10s ease 0s infinite both$/,
    );
    expect(tl.css().match(/@keyframes/g)).toHaveLength(1);
  });

  it('plays once when it does not loop', () => {
    const style = new Timeline(2, false).animate([[0, { opacity: 1 }]]).style as Record<
      string,
      string
    >;
    expect(style['--sdl-a']).toContain(' 1 both');
  });
});

describe('helpers', () => {
  it('animate and fadeIn do nothing without a timeline, so the final frame shows', () => {
    expect(animate(null, [[0, { opacity: 0 }]])).toEqual({});
    expect(fadeIn(null, 1)).toEqual({});
  });

  it('fadeIn also resets a transform it started from', () => {
    const tl = new Timeline(1, false);
    fadeIn(tl, 0, 0.5, { transform: 'scale(.9)' });
    expect(tl.css()).toContain('transform:none');
  });

  it('withAnimation merges styles and class names', () => {
    expect(withAnimation({ left: 1 }, {}, 'x')).toEqual({ style: { left: 1 }, className: 'x' });
    const merged = withAnimation(
      { left: 1 },
      new Timeline(1, false).animate([[0, { opacity: 1 }]]),
    );
    expect(merged.className).toBe('sdl-a');
    expect(merged.style).toHaveProperty('left', 1);
    expect(withAnimation({}, {})).toEqual({ style: {} });
  });
});
