import { describe, expect, it } from 'vitest';

import { chooseSmaller, fitWithin } from './fit-within';

describe('fitWithin', () => {
  it('scales the long edge to 2048 and keeps the aspect ratio', () => {
    expect(fitWithin(4096, 2048)).toEqual({ width: 2048, height: 1024, scaled: true });
    expect(fitWithin(1000, 4000)).toEqual({ width: 512, height: 2048, scaled: true });
  });

  it('never upscales', () => {
    expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480, scaled: false });
    expect(fitWithin(2048, 2048)).toEqual({ width: 2048, height: 2048, scaled: false });
  });

  it('never returns a side below one pixel', () => {
    expect(fitWithin(100000, 1)).toEqual({ width: 2048, height: 1, scaled: true });
  });
});

describe('chooseSmaller', () => {
  const of = (length: number) => ({ bytes: new Uint8Array(length) });

  it('keeps the original when the result is not smaller', () => {
    const original = of(10);
    expect(chooseSmaller(original, of(10))).toBe(original);
    expect(chooseSmaller(original, of(11))).toBe(original);
  });

  it('takes the result when it is smaller', () => {
    const smaller = of(5);
    expect(chooseSmaller(of(10), smaller)).toBe(smaller);
  });
});
