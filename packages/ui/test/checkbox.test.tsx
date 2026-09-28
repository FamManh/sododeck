import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from '../src/components/checkbox';

describe('Checkbox', () => {
  it('is named by its label and toggles with Space', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Clients" onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole('checkbox', { name: 'Clients' });
    expect(box).toHaveAttribute('aria-checked', 'false');
    await user.tab();
    expect(box).toHaveFocus();
    await user.keyboard(' ');
    expect(box).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('toggles when its label text is clicked', async () => {
    render(<Checkbox label="Clients" />);
    await userEvent.click(screen.getByText('Clients'));
    expect(screen.getByRole('checkbox', { name: 'Clients' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('shows the mixed state', () => {
    render(<Checkbox label="Clients" checked="indeterminate" />);
    expect(screen.getByRole('checkbox', { name: 'Clients' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
  });

  it('does not toggle when disabled', async () => {
    render(<Checkbox label="Clients" disabled />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Clients' }));
    expect(screen.getByRole('checkbox', { name: 'Clients' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
