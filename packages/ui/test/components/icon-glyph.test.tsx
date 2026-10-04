import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IconGlyph } from '../../src/components/icon-glyph';
import { resolveIcon } from '../../src/icon-sets';
import { solidTestSet } from '../fixtures/solid-test-set';
import { lucide } from '../../src/icon-sets';

function glyph(ref: string) {
  const icon = resolveIcon(ref, [lucide, solidTestSet]);
  if (!icon) throw new Error(`no icon ${ref}`);
  return icon;
}

describe('IconGlyph', () => {
  it('draws a line icon as strokes', () => {
    const { container } = render(
      <IconGlyph icon={glyph('lucide:search')} size={20} strokeWidth={2} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('stroke-width', '2');
    expect(svg).toHaveAttribute('stroke-linecap', 'round');
    expect(svg).toHaveAttribute('stroke-linejoin', 'round');
    expect(svg?.children.length).toBe(glyph('lucide:search').node.length);
  });

  it('draws a solid icon as fills with no stroke', () => {
    const { container } = render(<IconGlyph icon={glyph('solid-test:dot')} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('fill', 'currentColor');
    expect(svg).toHaveAttribute('stroke', 'none');
    expect(svg).not.toHaveAttribute('stroke-width');
  });

  it('is hidden from assistive technology', () => {
    const { container } = render(<IconGlyph icon={glyph('lucide:search')} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
