import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RadioGroup, RadioGroupItem } from '../src/components/radio-group';

function Subtitle({ onValueChange }: { onValueChange?: (value: string) => void }) {
  return (
    <RadioGroup aria-label="Subtitle" defaultValue="tech" onValueChange={onValueChange}>
      <RadioGroupItem value="tech" label="Technology" />
      <RadioGroupItem value="host" label="Hosting" />
      <RadioGroupItem value="none" label="None" />
    </RadioGroup>
  );
}

describe('RadioGroup', () => {
  it('names the group and each radio by its label', () => {
    render(<Subtitle />);
    expect(screen.getByRole('radiogroup', { name: 'Subtitle' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(screen.getByRole('radio', { name: 'Hosting' })).toBeInTheDocument();
  });

  it('moves the selection with the arrow keys', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Subtitle onValueChange={onValueChange} />);
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Technology' })).toHaveFocus();
    // Hold the key like a real press: Radix selects on focus while an arrow key is down.
    await user.keyboard('{ArrowDown>}');
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Hosting' })).toHaveFocus();
    });
    await user.keyboard('{/ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Hosting' })).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange).toHaveBeenLastCalledWith('host');
  });

  it('selects by clicking the label text', async () => {
    render(<Subtitle />);
    await userEvent.click(screen.getByText('None'));
    expect(screen.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true');
  });
});
