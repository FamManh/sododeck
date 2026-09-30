import { describe, expect, it } from 'vitest';

import { CARD_COLORS, colourName, resolveLook } from './card-style';

describe('resolveLook', () => {
  it('returns undefined with no style', () => {
    expect(resolveLook(undefined)).toBeUndefined();
  });

  it('gives a named fill its token, namedFill true and the default text colour', () => {
    const look = resolveLook({ fill: 'green' });
    expect(look).toEqual({
      fill: 'var(--color-card-green-fill)',
      stroke: undefined,
      text: 'default',
      namedFill: true,
      fillRef: 'green',
      strokeRef: undefined,
    });
  });

  it('gives a hex fill the hex as-is, text from readableText, and namedFill false', () => {
    const look = resolveLook({ fill: '#1f2a44' });
    expect(look).toEqual({
      fill: '#1f2a44',
      stroke: undefined,
      text: 'light',
      namedFill: false,
      fillRef: '#1f2a44',
      strokeRef: undefined,
    });
  });

  it('leaves fill undefined when only a stroke is set', () => {
    const look = resolveLook({ stroke: 'blue' });
    expect(look).toEqual({
      fill: undefined,
      stroke: 'var(--color-card-blue-stroke)',
      text: 'default',
      namedFill: false,
      fillRef: undefined,
      strokeRef: 'blue',
    });
  });

  it('a preview overrides only its channel', () => {
    const look = resolveLook({ fill: 'green', stroke: 'blue' }, { channel: 'fill', value: 'red' });
    expect(look).toEqual({
      fill: 'var(--color-card-red-fill)',
      stroke: 'var(--color-card-blue-stroke)',
      text: 'default',
      namedFill: true,
      fillRef: 'red',
      strokeRef: 'blue',
    });
  });
});

describe('colourName', () => {
  it('title-cases a named colour', () => {
    expect(colourName('green')).toBe('Green');
  });

  it('gives a hex value as-is', () => {
    expect(colourName('#7a3cff')).toBe('#7a3cff');
  });
});

describe('CARD_COLORS', () => {
  it('lists all 13 named colours', () => {
    expect(CARD_COLORS).toHaveLength(13);
    expect(CARD_COLORS).toContain('green');
  });
});
