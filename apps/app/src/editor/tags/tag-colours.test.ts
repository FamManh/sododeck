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
