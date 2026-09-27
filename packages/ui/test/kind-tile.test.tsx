import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { KindTile } from '../src/components/kind-tile';
import { COMPONENT_KINDS, KIND_STYLE } from '../src/lib/icons';

describe('KindTile', () => {
  it.each(COMPONENT_KINDS)('renders %s as a labelled image with its tone', (kind) => {
    render(<KindTile kind={kind} />);
    const tile = screen.getByRole('img', { name: KIND_STYLE[kind].label });
    expect(tile).toHaveAttribute('data-kind', kind);
    expect(tile).toHaveClass(...KIND_STYLE[kind].tone.split(' '));
    expect(tile.querySelector('svg')).not.toBeNull();
  });

  it.each([
    [22, 7],
    [28, 8],
    [30, 9],
    [40, 12],
  ] as const)('size %i has a %ipx radius', (size, radius) => {
    render(<KindTile kind="service" size={size} />);
    const tile = screen.getByRole('img', { name: 'Service' });
    expect(tile).toHaveAttribute('data-size', String(size));
    expect(tile.style.width).toBe(`${String(size)}px`);
    expect(tile.style.borderRadius).toBe(`${String(radius)}px`);
  });

  it('defaults to 30px', () => {
    render(<KindTile kind="queue" />);
    expect(screen.getByRole('img', { name: 'Queue' })).toHaveAttribute('data-size', '30');
  });

  it('accepts prototype aliases and any case', () => {
    render(<KindTile kind="Data" />);
    expect(screen.getByRole('img', { name: 'Database' })).toBeInTheDocument();
  });

  it('shows a neutral fallback for unknown kinds', () => {
    render(<KindTile kind="mainframe" />);
    expect(screen.getByRole('img', { name: 'Component' })).toHaveAttribute('data-kind', 'unknown');
  });

  it('is hidden from assistive technology when decorative', () => {
    const { container } = render(<KindTile kind="client" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
