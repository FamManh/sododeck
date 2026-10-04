import { resolveIcon } from '@sododeck/ui/icon-sets';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NodeTypeTile } from './shape-tile';

const search = resolveIcon('lucide:search');

describe('NodeTypeTile icon prop', () => {
  it('draws the given icon on a card type and keeps the type tone', () => {
    if (!search) throw new Error('search icon missing');
    const { container } = render(<NodeTypeTile type="service" icon={search} decorative />);
    const tile = container.querySelector('[data-slot="type-tile"]');
    expect(tile?.getAttribute('data-type')).toBe('service');
    const plain = render(<NodeTypeTile type="service" decorative />).container;
    expect(tile?.className).toBe(plain.querySelector('[data-slot="type-tile"]')?.className);
    expect(tile?.innerHTML).not.toBe(plain.querySelector('[data-slot="type-tile"]')?.innerHTML);
    expect(tile?.querySelector('circle')).not.toBeNull();
  });

  it('ignores the icon for a shape type', () => {
    if (!search) throw new Error('search icon missing');
    const { container } = render(<NodeTypeTile type="rectangle" icon={search} decorative />);
    expect(container.querySelector('[data-testid="shape-glyph"]')).not.toBeNull();
    expect(container.querySelector('circle')).toBeNull();
  });
});
