import { readFileSync } from 'node:fs';

import type { CardColor } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { exportLook, LIGHT_PALETTE } from './export-palette';

// By package name, never a relative path across packages. (Vitest stubs CSS, even with `?raw`.)
const tokensCss = readFileSync(new URL(import.meta.resolve('@sododeck/ui/tokens.css')), 'utf8');
const light = /:root\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '';

const TOKEN_OF: Record<
  Exclude<keyof typeof LIGHT_PALETTE, 'cardColours' | 'cardChips' | 'cardText'>,
  string
> = {
  canvas: 'canvas',
  surface: 'surface',
  surface2: 'surface-2',
  surface3: 'surface-3',
  border: 'border',
  borderStrong: 'border-strong',
  hairline: 'hairline',
  group: 'group',
  ink: 'ink',
  inkSecondary: 'text-secondary',
  inkMuted: 'muted',
  edge: 'edge',
  deckEdge: 'deck-edge',
  primary: 'primary',
  primarySoft: 'primary-soft',
  primaryInk: 'primary-ink',
  onPrimary: 'on-primary',
  clayInk: 'clay-ink',
  claySoft: 'clay-soft',
  amberSoft: 'amber-soft',
  amberInk: 'amber-ink',
  blueSoft: 'blue-soft',
  blueInk: 'blue-ink',
  successSoft: 'success-soft',
  successInk: 'success-ink',
  inverse: 'inverse',
  onInverse: 'on-inverse',
};

describe('LIGHT_PALETTE', () => {
  it.each(Object.entries(TOKEN_OF))('%s equals the light --sd-%s token', (key, token) => {
    const value = new RegExp(`--sd-${token}:\\s*([^;]+);`).exec(light)?.[1]?.trim();
    expect(value).toBe(LIGHT_PALETTE[key as keyof typeof LIGHT_PALETTE]);
  });

  it.each(Object.keys(LIGHT_PALETTE.cardColours) as CardColor[])(
    '%s card colour equals the light --sd-card-%s-{fill,stroke} tokens',
    (colour) => {
      const fill = new RegExp(`--sd-card-${colour}-fill:\\s*([^;]+);`).exec(light)?.[1]?.trim();
      const stroke = new RegExp(`--sd-card-${colour}-stroke:\\s*([^;]+);`).exec(light)?.[1]?.trim();
      expect({ fill, stroke }).toEqual(LIGHT_PALETTE.cardColours[colour]);
    },
  );

  it.each(Object.keys(LIGHT_PALETTE.cardChips) as CardColor[])(
    '%s chip and ink equal the light --sd-card-%s-{chip,ink} tokens',
    (colour) => {
      const chip = new RegExp(`--sd-card-${colour}-chip:\\s*([^;]+);`).exec(light)?.[1]?.trim();
      const ink = new RegExp(`--sd-card-${colour}-ink:\\s*([^;]+);`).exec(light)?.[1]?.trim();
      expect({ chip, ink }).toEqual(LIGHT_PALETTE.cardChips[colour]);
    },
  );

  it.each(['dark', 'light'] as const)(
    'cardText.%s equals the light --sd-card-text-%s token',
    (role) => {
      const value = new RegExp(`--sd-card-text-${role}:\\s*([^;]+);`).exec(light)?.[1]?.trim();
      expect(value).toBe(LIGHT_PALETTE.cardText[role]);
    },
  );
});

describe('exportLook chips (029)', () => {
  it('follows a named fill with its chip and ink', () => {
    expect(exportLook({ fill: 'teal' })).toMatchObject({
      chip: LIGHT_PALETTE.cardChips.teal.chip,
      ink: LIGHT_PALETTE.cardChips.teal.ink,
      namedFill: true,
    });
  });

  it('follows the stroke when only that is set', () => {
    expect(exportLook({ stroke: 'blue' })).toMatchObject({
      chip: LIGHT_PALETTE.cardChips.blue.chip,
      namedFill: false,
    });
  });

  it('uses a custom fill as the chip, with readable ink', () => {
    expect(exportLook({ fill: '#123456' })).toMatchObject({
      chip: '#123456',
      ink: LIGHT_PALETTE.cardText.light,
      namedFill: false,
    });
  });

  it('has no look without a colour', () => {
    expect(exportLook(undefined)).toBeUndefined();
  });
});
