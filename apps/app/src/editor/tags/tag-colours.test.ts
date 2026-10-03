import { readFileSync } from 'node:fs';

import { contrastRatio } from '@sododeck/ui/lib/contrast';
import { describe, expect, it } from 'vitest';

import { tagColours } from './tag-colours';

describe('tagColours', () => {
  it('maps a named colour to its chip, ink and dot tokens', () => {
    expect(tagColours('violet')).toEqual({
      chip: 'var(--color-card-violet-chip)',
      ink: 'var(--color-card-violet-ink)',
      dot: 'var(--color-card-violet-dot)',
    });
  });

  it('uses a hex for chip and dot, with a readable ink token', () => {
    expect(tagColours('#1f2a44')).toEqual({
      chip: '#1f2a44',
      ink: 'var(--color-card-text-light)',
      dot: '#1f2a44',
    });
    expect(tagColours('#fff59d')).toEqual({
      chip: '#fff59d',
      ink: 'var(--color-card-text-dark)',
      dot: '#fff59d',
    });
  });

  it('gives no colour the slate tokens', () => {
    expect(tagColours(undefined)).toEqual({
      chip: 'var(--color-card-slate-chip)',
      ink: 'var(--color-card-slate-ink)',
      dot: 'var(--color-card-slate-dot)',
    });
  });
});

describe('field option chips (032 FR-011, SC-006)', () => {
  // Field options take the same chip / ink as tags, so 033's contrast guarantees carry over.
  const tokensCss = readFileSync(new URL(import.meta.resolve('@sododeck/ui/tokens.css')), 'utf8');
  const hexTokens = (block: string) =>
    new Map(
      [...block.matchAll(/--sd-([a-z0-9-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map(
        (m) => [m[1] ?? '', m[2] ?? ''] as const,
      ),
    );
  const light = hexTokens(/:root\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '');
  const dark = new Map([...light, ...hexTokens(/\.dark\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '')]);
  const token = (value: string) => /var\(--color-(.+)\)/.exec(value)?.[1] ?? '';
  const NAMES = [
    'red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'teal',
    'cyan',
    'blue',
    'indigo',
    'violet',
    'pink',
    'slate',
  ] as const;

  it.each(NAMES)('%s option text reaches 4.5:1 on its chip in both themes', (name) => {
    const { chip, ink } = tagColours(name);
    for (const theme of [light, dark]) {
      const fg = theme.get(`card-${token(ink).replace(/^card-/, '')}`) ?? theme.get(token(ink));
      const bg = theme.get(`card-${token(chip).replace(/^card-/, '')}`) ?? theme.get(token(chip));
      expect(fg).toBeDefined();
      expect(bg).toBeDefined();
      expect(contrastRatio(fg ?? '', bg ?? '')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('an option with no colour is slate', () => {
    expect(tagColours(undefined)).toEqual(tagColours('slate'));
  });

  it.each(['#2f6fde', '#1f2a44', '#fff59d', '#7a3cff', '#00a28d'])(
    'deck colour %s gets an ink that reaches 4.5:1',
    (hex) => {
      const { ink } = tagColours(hex);
      const text = ink.includes('light') ? '#ffffff' : '#1c1c1a';
      expect(contrastRatio(hex, text)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
