import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InlineEdit } from '../src/components/inline-edit';

describe('InlineEdit', () => {
  it('commits on Enter', async () => {
    const onCommit = vi.fn();
    render(<InlineEdit label="Deck name" value="Checkout" onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Deck name' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Payments{Enter}');
    expect(onCommit).toHaveBeenCalledWith('Payments');
  });

  it('reverts on Escape without committing', async () => {
    const onCommit = vi.fn();
    render(<InlineEdit label="Deck name" value="Checkout" onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Deck name' });
    await userEvent.type(input, ' draft{Escape}');
    expect(input).toHaveValue('Checkout');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits on blur', async () => {
    const onCommit = vi.fn();
    render(<InlineEdit label="Deck name" value="Checkout" onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Deck name' });
    await userEvent.type(input, ' v2');
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledWith('Checkout v2');
  });

  it('does not commit an unchanged value', async () => {
    const onCommit = vi.fn();
    render(<InlineEdit label="Deck name" value="Checkout" onCommit={onCommit} />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Deck name' }));
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
