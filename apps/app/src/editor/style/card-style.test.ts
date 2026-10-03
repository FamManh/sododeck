import { describe, expect, it } from 'vitest';

import { CARD_COLORS, colourName, NEUTRAL_CHIP, resolveLook } from './card-style';

describe('resolveLook', () => {
  it('returns undefined with no style', () => {
    expect(resolveLook(undefined)).toBeUndefined();
  });

  it('gives a named fill its token, namedFill true and the default text colour', () => {
    const look = resolveLook({ fill: 'green' });
    expect(look).toEqual({
      fill: 'var(--color-card-green-fill)',
      stroke: undefined,
      chip: 'var(--color-card-green-chip)',
      ink: 'var(--color-card-green-ink)',
      dot: 'var(--color-card-green-dot)',
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
      chip: '#1f2a44',
      ink: 'var(--color-card-text-light)',
      dot: '#1f2a44',
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
      chip: 'var(--color-card-blue-chip)',
      ink: 'var(--color-card-blue-ink)',
      dot: 'var(--color-card-blue-dot)',
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
      chip: 'var(--color-card-red-chip)',
      ink: 'var(--color-card-red-ink)',
      dot: 'var(--color-card-red-dot)',
      text: 'default',
      namedFill: true,
      fillRef: 'red',
      strokeRef: 'blue',
    });
  });
});

describe('resolveLook chip, ink and dot (029)', () => {
  it('a named colour maps to its three channel tokens', () => {
    const look = resolveLook({ fill: 'teal', stroke: 'teal' });
    expect(look).toMatchObject({
      chip: 'var(--color-card-teal-chip)',
      ink: 'var(--color-card-teal-ink)',
      dot: 'var(--color-card-teal-dot)',
    });
  });

  it('a custom hex is the chip and the dot, with the readable text colour as ink', () => {
    expect(resolveLook({ fill: '#ffe08a' })).toMatchObject({
      chip: '#ffe08a',
      ink: 'var(--color-card-text-dark)',
      dot: '#ffe08a',
    });
    expect(resolveLook({ fill: '#10204a' })).toMatchObject({
      chip: '#10204a',
      ink: 'var(--color-card-text-light)',
      dot: '#10204a',
    });
  });

  it('follows the fill when both channels are set, the stroke when only it is', () => {
    expect(resolveLook({ fill: 'red', stroke: 'blue' })).toMatchObject({
      chip: 'var(--color-card-red-chip)',
    });
    expect(resolveLook({ stroke: '#112233' })).toMatchObject({ chip: '#112233', dot: '#112233' });
  });

  it('a preview moves the chip with the channel it overrides', () => {
    expect(resolveLook({ fill: 'green' }, { channel: 'fill', value: 'pink' })).toMatchObject({
      chip: 'var(--color-card-pink-chip)',
    });
  });

  it('an uncoloured card has no look; NEUTRAL_CHIP is Surface 2, Secondary and the neutral dot', () => {
    expect(resolveLook({})).toBeUndefined();
    expect(NEUTRAL_CHIP).toEqual({
      chip: 'var(--color-surface-2)',
      ink: 'var(--color-ink-secondary)',
      dot: 'var(--color-deck-dot-neutral)',
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
