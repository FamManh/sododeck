import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { arrowPathAt } from './edge-end-marks';
import { EdgeEnds } from './edge-ends';
import { ARROW_LENGTH, ARROW_WIDTH, KNOB_RADIUS } from './edge-constants';

const ends = {
  start: { x: 10, y: 20 },
  end: { x: 110, y: 60 },
  startDir: { x: 1, y: 0 },
  endDir: { x: 1, y: 0 },
};

function draw(direction?: 'forward' | 'both' | 'none', override: Partial<typeof ends> = {}) {
  const { container } = render(
    <svg>
      <EdgeEnds {...ends} {...override} {...(direction === undefined ? {} : { direction })} />
    </svg>,
  );
  return {
    knobs: [...container.querySelectorAll('[data-testid="edge-knob"]')],
    arrows: [...container.querySelectorAll('[data-testid="edge-arrow"]')],
    all: [...container.querySelectorAll('[data-testid="edge-knob"], [data-testid="edge-arrow"]')],
  };
}

describe('EdgeEnds', () => {
  it.each([undefined, 'forward'] as const)(
    'direction %s: a knob at the start and an arrow at the end',
    (direction) => {
      const { knobs, arrows } = draw(direction);
      expect(knobs).toHaveLength(1);
      expect(arrows).toHaveLength(1);
      expect(knobs[0]?.getAttribute('cx')).toBe('10');
      expect(knobs[0]?.getAttribute('cy')).toBe('20');
      expect(knobs[0]?.getAttribute('r')).toBe(String(KNOB_RADIUS));
      expect(knobs[0]?.getAttribute('r')).toBe('3.5');
      expect(arrows[0]?.getAttribute('d')).toBe(arrowPathAt(110, 60, 0));
    },
  );

  it('draws a filled triangle 9 long and 10 wide with a round-joined 2px stroke', () => {
    expect(ARROW_LENGTH).toBe(9);
    expect(ARROW_WIDTH).toBe(10);
    const { arrows } = draw('forward');
    const arrow = arrows[0];
    expect(arrow?.getAttribute('d')).toBe('M 110 60 L 101 55 L 101 65 Z');
    expect(arrow?.hasAttribute('transform')).toBe(false);
    expect(arrow?.getAttribute('fill')).toBe('currentColor');
    expect(arrow?.getAttribute('stroke')).toBe('currentColor');
    expect(arrow?.getAttribute('stroke-width')).toBe('2');
    expect(arrow?.getAttribute('stroke-linejoin')).toBe('round');
  });

  it('both: arrows at both ends, no knob', () => {
    const { knobs, arrows } = draw('both');
    expect(knobs).toHaveLength(0);
    expect(arrows).toHaveLength(2);
    // The start arrow points back into the source, against the line's first direction.
    expect(arrows[0]?.getAttribute('d')).toBe(arrowPathAt(10, 20, 180));
    expect(arrows[1]?.getAttribute('d')).toBe(arrowPathAt(110, 60, 0));
  });

  it('none: knobs at both ends, no arrow', () => {
    const { knobs, arrows } = draw('none');
    expect(arrows).toHaveLength(0);
    expect(knobs.map((k) => [k.getAttribute('cx'), k.getAttribute('cy')])).toEqual([
      ['10', '20'],
      ['110', '60'],
    ]);
  });

  it('the arrow rotation follows endDir', () => {
    const down = draw('forward', { endDir: { x: 0, y: 1 } }).arrows[0];
    const left = draw('forward', { endDir: { x: -1, y: 0 } }).arrows[0];
    expect(down?.getAttribute('d')).toBe(arrowPathAt(110, 60, 90));
    expect(left?.getAttribute('d')).toBe(arrowPathAt(110, 60, 180));
  });

  it('every mark is hidden from assistive technology', () => {
    for (const direction of ['forward', 'both', 'none'] as const) {
      const { all } = draw(direction);
      expect(all.length).toBeGreaterThan(0);
      for (const mark of all) expect(mark.getAttribute('aria-hidden')).toBe('true');
    }
  });

  describe('error end (035)', () => {
    it('draws a × instead of the arrow, centred on the end, and keeps the start knob', () => {
      const { container } = render(
        <svg>
          <EdgeEnds {...ends} direction="forward" errorEnd />
        </svg>,
      );
      expect(container.querySelector('[data-testid="edge-arrow"]')).toBeNull();
      const cross = container.querySelector('[data-testid="edge-cross"]');
      expect(cross).not.toBeNull();
      expect(cross?.getAttribute('aria-hidden')).toBe('true');
      expect(cross?.getAttribute('d')).toBe('M 105 55 L 115 65 M 105 65 L 115 55');
      expect(container.querySelectorAll('[data-testid="edge-knob"]')).toHaveLength(1);
    });

    it('keeps the arrow when the connector is not an error path', () => {
      const { container } = render(
        <svg>
          <EdgeEnds {...ends} direction="forward" />
        </svg>,
      );
      expect(container.querySelector('[data-testid="edge-cross"]')).toBeNull();
      expect(container.querySelector('[data-testid="edge-arrow"]')).not.toBeNull();
    });
  });
});
