import { readFileSync } from 'node:fs';

import type { CardColor } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { LIGHT_PALETTE } from './export-palette';

// By package name, never a relative path across packages. (Vitest stubs CSS, even with `?raw`.)
const tokensCss = readFileSync(new URL(import.meta.resolve('@sododeck/ui/tokens.css')), 'utf8');
const light = /:root\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '';

const TOKEN_OF: Record<Exclude<keyof typeof LIGHT_PALETTE, 'cardColours' | 'cardText'>, string> = {
  canvas: 'canvas',
  surface: 'surface',
  surface2: 'surface-2',
  border: 'border',
  hairline: 'hairline',
  group: 'group',
  ink: 'ink',
  inkSecondary: 'text-secondary',
  inkMuted: 'muted',
  edge: 'edge',
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

  it.each(['dark', 'light'] as const)(
    'cardText.%s equals the light --sd-card-text-%s token',
    (role) => {
      const value = new RegExp(`--sd-card-text-${role}:\\s*([^;]+);`).exec(light)?.[1]?.trim();
      expect(value).toBe(LIGHT_PALETTE.cardText[role]);
    },
  );
});
