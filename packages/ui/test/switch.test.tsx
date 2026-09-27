import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from '../src/components/switch';

describe('Switch', () => {
  it('toggles with Space and reports the change', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Include notes" onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole('switch', { name: 'Include notes' });
    expect(control).toHaveAttribute('aria-checked', 'false');
    await user.tab();
    await user.keyboard(' ');
    expect(control).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when disabled', async () => {
    render(<Switch aria-label="Include notes" disabled />);
    const control = screen.getByRole('switch', { name: 'Include notes' });
    await userEvent.click(control);
    expect(control).toHaveAttribute('aria-checked', 'false');
  });
});
