import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DeckThumbnail } from './deck-thumbnail';

describe('DeckThumbnail', () => {
  it('draws one shape per node and group', () => {
    const { container } = render(
      <DeckThumbnail
        name="Shop"
        thumb={{
          w: 1000,
          h: 400,
          node: [160, 50],
          nodes: [
            [0, 0, 'service'],
            [500, 300, 'database'],
          ],
          groups: [[0, 0, 700, 400]],
        }}
      />,
    );
    const svg = screen.getByRole('img', { name: 'Shop preview' });
    expect(svg.querySelectorAll('rect')).toHaveLength(3);
    expect(container.querySelectorAll('rect[stroke-dasharray]')).toHaveLength(1);
  });

  it('shows only the dotted background for an empty deck', () => {
    render(<DeckThumbnail name="Empty" thumb={null} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('draws a resized card at its own size, not the default (017 R13)', () => {
    const { container } = render(
      <DeckThumbnail
        name="Shop"
        thumb={{
          w: 1000,
          h: 400,
          node: [160, 50],
          nodes: [
            [0, 0, 'service'],
            [500, 300, 'database', 300, 120],
          ],
          groups: [],
        }}
      />,
    );
    const rects = container.querySelectorAll('rect');
    expect(rects[0]).toHaveAttribute('width', '160');
    expect(rects[0]).toHaveAttribute('height', '50');
    expect(rects[1]).toHaveAttribute('width', '300');
    expect(rects[1]).toHaveAttribute('height', '120');
  });
});

describe('DeckThumbnail card types (030)', () => {
  it('draws new and unknown types without errors, unknown ones neutral', () => {
    const { container } = render(
      <DeckThumbnail
        name="Hub"
        thumb={{
          w: 1000,
          h: 400,
          node: [160, 50],
          nodes: [
            [0, 0, 'warehouse'],
            [200, 0, 'truck-route'],
            [400, 0, 'robot'],
            [600, 0, 'issue'],
          ],
          groups: [],
        }}
      />,
    );
    const rects = [...container.querySelectorAll('rect')];
    expect(rects).toHaveLength(4);
    expect(rects[0]).toHaveClass('fill-success-soft');
    expect(rects[1]).toHaveClass('fill-amber-soft');
    expect(rects[2]).toHaveClass('fill-surface-2');
    expect(rects[3]).toHaveClass('fill-clay-soft');
  });
});
