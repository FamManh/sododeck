import type { StickyColor } from '@sododeck/schema';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StickyPaper } from './sticky-paper';
import { STICKY_TINT } from './sticky-tint';

const COLOURS: StickyColor[] = ['amber', 'blue', 'green', 'clay', 'grey'];

// A literal colour in a class: hex, rgb(a), hsl(a) or a named colour function.
const HARD_CODED = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/i;

describe('StickyPaper (053 US2)', () => {
  it.each(COLOURS)('renders %s with its tint and readable text', (color) => {
    render(
      <StickyPaper color={color} data-testid="paper">
        Owner is the platform team
      </StickyPaper>,
    );
    const paper = screen.getByTestId('paper');
    expect(paper).toHaveAttribute('data-color', color);
    expect(screen.getByText('Owner is the platform team')).toBeInTheDocument();
    // The ink and background come from the colour's own tokens, in light and dark alike.
    for (const token of STICKY_TINT[color].split(' ')) expect(paper).toHaveClass(token);
  });

  it('defaults to amber', () => {
    render(<StickyPaper color={undefined} data-testid="paper" />);
    expect(screen.getByTestId('paper')).toHaveAttribute('data-color', 'amber');
  });

  it('has no header, icon or lip: just the sheet and what it is given', () => {
    const { container } = render(<StickyPaper color="blue">text</StickyPaper>);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('header')).toBeNull();
    expect(container.firstElementChild?.children).toHaveLength(0);
    expect(container.firstElementChild?.className).not.toMatch(/lip/);
  });

  it('lifts the shadow when selected or dragged', () => {
    const { rerender } = render(<StickyPaper color="grey" data-testid="paper" />);
    expect(screen.getByTestId('paper')).toHaveClass('shadow-note');
    rerender(<StickyPaper color="grey" lifted data-testid="paper" />);
    expect(screen.getByTestId('paper')).toHaveClass('shadow-note-lift');
  });

  it.each(COLOURS)('uses tokens only for %s (no hard-coded colour)', (color) => {
    render(<StickyPaper color={color} data-testid="paper" />);
    expect(screen.getByTestId('paper').className).not.toMatch(HARD_CODED);
    expect(STICKY_TINT[color]).not.toMatch(HARD_CODED);
  });
});
