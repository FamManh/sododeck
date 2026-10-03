import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TypeTile } from '../src/components/type-tile';
import { TYPE_STYLE } from '../src/lib/icons';

describe('TypeTile', () => {
  it.each(Object.keys(TYPE_STYLE))('renders %s as a labelled image with its tone', (type) => {
    render(<TypeTile type={type} label={`Name of ${type}`} />);
    const tile = screen.getByRole('img', { name: `Name of ${type}` });
    expect(tile).toHaveAttribute('data-type', type);
    expect(tile).toHaveClass(...(TYPE_STYLE[type]?.tone.split(' ') ?? []));
    expect(tile.querySelector('svg')).not.toBeNull();
  });

  it.each([
    [22, 7],
    [28, 8],
    [30, 9],
    [40, 12],
  ] as const)('size %i has a %ipx radius', (size, radius) => {
    render(<TypeTile type="service" label="Service" size={size} />);
    const tile = screen.getByRole('img', { name: 'Service' });
    expect(tile).toHaveAttribute('data-size', String(size));
    expect(tile.style.width).toBe(`${String(size)}px`);
    expect(tile.style.borderRadius).toBe(`${String(radius)}px`);
  });

  it('defaults to 30px', () => {
    render(<TypeTile type="queue" label="Queue" />);
    expect(screen.getByRole('img', { name: 'Queue' })).toHaveAttribute('data-size', '30');
  });

  it('accepts prototype aliases and any case', () => {
    render(<TypeTile type="Data" label="Database" />);
    expect(screen.getByRole('img', { name: 'Database' })).toBeInTheDocument();
  });

  it('names an image after the id when the caller gives no label', () => {
    render(<TypeTile type="robot" />);
    expect(screen.getByRole('img', { name: 'robot' })).toBeInTheDocument();
  });

  it('shows a neutral fallback tile for unknown types', () => {
    render(<TypeTile type="mainframe" label="mainframe" />);
    expect(screen.getByRole('img', { name: 'mainframe' })).toHaveAttribute(
      'data-type',
      'mainframe',
    );
  });

  it('is hidden from assistive technology when decorative', () => {
    const { container } = render(<TypeTile type="client" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
