import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Input } from '../src/components/input';

function Labelled(props: React.ComponentProps<typeof Input>) {
  return (
    <label>
      Owner
      <Input {...props} />
    </label>
  );
}

describe('Input', () => {
  it('is a labelled textbox that accepts typing', async () => {
    render(<Labelled />);
    const input = screen.getByRole('textbox', { name: 'Owner' });
    await userEvent.type(input, 'payments');
    expect(input).toHaveValue('payments');
  });

  it('marks invalid input with aria-invalid and an icon', () => {
    const { container, rerender } = render(<Labelled invalid />);
    expect(screen.getByRole('textbox', { name: 'Owner' })).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('svg')).not.toBeNull();

    rerender(<Labelled />);
    expect(screen.getByRole('textbox', { name: 'Owner' })).not.toHaveAttribute('aria-invalid');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('cannot be typed into when disabled', async () => {
    render(<Labelled disabled />);
    const input = screen.getByRole('textbox', { name: 'Owner' });
    await userEvent.type(input, 'x');
    expect(input).toHaveValue('');
  });
});
