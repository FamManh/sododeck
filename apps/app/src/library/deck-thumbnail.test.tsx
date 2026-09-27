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
});
