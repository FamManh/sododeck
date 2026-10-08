import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FlowToken } from './flow-token';

function reduceMotion(reduce: boolean) {
  return vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: reduce && query.includes('reduce'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

function draw(number = '3', speed: 1 | 2 = 1) {
  return render(
    <svg>
      <FlowToken path="M 0 0 L 100 0" x={50} y={0} speed={speed} number={number} />
    </svg>,
  );
}

describe('FlowToken (035)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a numbered disc, hidden from assistive technology', () => {
    draw('4b');
    const token = screen.getByTestId('flow-token');
    expect(token).toHaveAttribute('aria-hidden', 'true');
    expect(token).toHaveTextContent('4b');
    expect(token.querySelector('text')).toHaveTextContent('4b');
  });

  it('draws the lip, the ring and the disc from tokens, 24px across', () => {
    draw();
    const circles = [...screen.getByTestId('flow-token').querySelectorAll('circle')];
    expect(circles.map((c) => c.getAttribute('r'))).toContain('12');
    const fills = circles.map((c) => c.getAttribute('fill'));
    expect(fills).toContain('var(--color-deck-orange-ink)');
    expect(fills).toContain('var(--color-deck-orange)');
    // The ring is a Surface disc 2.5px larger than the orange one.
    expect(circles.find((c) => c.getAttribute('fill') === 'var(--color-surface)')).toHaveAttribute(
      'r',
      '14.5',
    );
  });

  it('travels the path with animateMotion when motion is allowed', () => {
    reduceMotion(false);
    draw('2', 2);
    const motion = screen.getByTestId('flow-token').querySelector('animateMotion');
    expect(motion).toHaveAttribute('path', 'M 0 0 L 100 0');
    expect(motion).toHaveAttribute('dur', '850ms');
  });

  it('is static at the label midpoint, still numbered, under reduced motion', () => {
    reduceMotion(true);
    draw('2');
    const token = screen.getByTestId('flow-token');
    expect(token.querySelector('animateMotion')).toBeNull();
    expect(token.getAttribute('transform')).toBe('translate(50 0)');
    expect(token).toHaveTextContent('2');
  });

  it('is the only token in the document', () => {
    draw();
    expect(screen.getAllByTestId('flow-token')).toHaveLength(1);
  });
});
