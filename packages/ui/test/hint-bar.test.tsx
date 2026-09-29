import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HintBar } from '../src/components/hint-bar';

const items = [
  { keys: '⇧', label: 'Add' },
  { keys: '⌥', label: 'Touch' },
  { keys: 'Esc', label: 'Cancel' },
];

describe('HintBar', () => {
  it('lists each key cap with its label, in order', () => {
    const { container } = render(<HintBar items={items} />);
    const bar = container.querySelector('[data-slot="hint-bar"]');
    expect(bar).not.toBeNull();
    expect(bar?.textContent).toBe('⇧Add⌥TouchEscCancel');
    const caps = [...container.querySelectorAll('kbd')].map((kbd) => kbd.textContent);
    expect(caps).toEqual(['⇧', '⌥', 'Esc']);
  });

  it('is presentational: no role, no live region, not focusable', () => {
    const { container } = render(<HintBar items={items} />);
    const bar = container.querySelector('[data-slot="hint-bar"]');
    expect(bar?.getAttribute('role')).toBeNull();
    expect(bar?.getAttribute('aria-live')).toBeNull();
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(container.querySelector('[tabindex]')).toBeNull();
  });

  it('passes extra props and classes through', () => {
    const { container } = render(<HintBar items={items} className="absolute" data-testid="h" />);
    expect(screen.getByTestId('h').className).toContain('absolute');
    expect(container.querySelector('[data-slot="hint-bar"]')).toBe(screen.getByTestId('h'));
  });
});
