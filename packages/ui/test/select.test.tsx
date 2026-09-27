import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../src/components/select';

function Protocol({
  onValueChange,
  disabled,
}: {
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select defaultValue="http" onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger aria-label="Protocol">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="http">HTTP</SelectItem>
        <SelectItem value="grpc">gRPC</SelectItem>
        <SelectItem value="async">Async</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe('Select', () => {
  it('opens with the keyboard and selects the next option', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Protocol onValueChange={onValueChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Protocol' });
    expect(trigger).toHaveTextContent('HTTP');

    await user.tab();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onValueChange).toHaveBeenCalledWith('grpc');
    expect(trigger).toHaveTextContent('gRPC');
  });

  it('closes on Escape without changing the value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Protocol onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(<Protocol disabled />);
    await user.click(screen.getByRole('combobox', { name: 'Protocol' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
