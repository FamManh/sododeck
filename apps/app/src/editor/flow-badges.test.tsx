import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StepBadge } from './flow-badges';
import type { EdgeBadge } from './flows/flow-overlay';

const badge = (patch: Partial<EdgeBadge> = {}): EdgeBadge => ({
  label: '3',
  errorPath: false,
  current: false,
  chainBreak: false,
  ...patch,
});

/**
 * The number inside the connector's label pill (035 FR-010, FR-011). The pill's size and colours
 * belong to the label in `deck-edge.tsx` / `merged-edge.tsx`; the badge inherits its text colour.
 */
describe('StepBadge (035)', () => {
  it('always carries the step number, in its name and in text', () => {
    render(<StepBadge badge={badge({ label: '4b' })} />);
    expect(screen.getByRole('img', { name: 'Step 4b' })).toHaveTextContent('4b');
  });

  it('takes the colour of the pill it sits in', () => {
    render(<StepBadge badge={badge()} />);
    const pill = screen.getByRole('img', { name: 'Step 3' });
    expect(pill.className).not.toMatch(/\bbg-/);
    expect(pill.className).toContain('font-semibold');
  });

  it('adds the ⊗ icon on an error path and says so in its name', () => {
    render(<StepBadge badge={badge({ errorPath: true })} />);
    const pill = screen.getByRole('img', { name: 'Step 3, error path' });
    expect(pill.querySelector('svg')).not.toBeNull();
    expect(pill).toHaveTextContent('3');
  });

  it('marks a chain break with a Clay chip, still named', () => {
    render(<StepBadge badge={badge({ chainBreak: true })} />);
    const pill = screen.getByRole('img', { name: 'Step 3, chain break' });
    expect(pill.className).toContain('bg-clay-soft');
    expect(pill.className).toContain('text-clay-ink');
  });

  it('adds no extra ring for the current step: the pill itself turns solid orange', () => {
    render(<StepBadge badge={badge({ current: true })} />);
    expect(screen.getByRole('img', { name: 'Step 3' }).className).not.toContain('ring');
  });
});
