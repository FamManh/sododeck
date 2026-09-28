import type * as React from 'react';
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

  it('focuses and selects all text on mount with autoFocus', () => {
    render(<InlineEdit label="Title" value="Order Service" onCommit={vi.fn()} autoFocus />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' });
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('Order Service'.length);
  });

  it('starts empty with a placeholder when startEmpty is set', () => {
    render(
      <InlineEdit
        label="Title"
        value="Untitled service"
        startEmpty
        placeholder="Name this component"
        onCommit={vi.fn()}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'Name this component');
  });

  it('calls onCancel on Escape, after reverting', async () => {
    const onCancel = vi.fn();
    const onCommit = vi.fn();
    render(<InlineEdit label="Title" value="A" onCommit={onCommit} onCancel={onCancel} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), 'bc{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('passes the draft to onKeyDown and skips the built-in Enter when it handled the key', async () => {
    const onCommit = vi.fn();
    const onKeyDown = vi.fn((event: React.KeyboardEvent<HTMLInputElement>, draft: string) => {
      if (event.key !== 'Enter') return false;
      expect(draft).toBe('Ab');
      return true;
    });
    render(<InlineEdit label="Title" value="A" onCommit={onCommit} onKeyDown={onKeyDown} />);
    const input = screen.getByRole('textbox', { name: 'Title' });
    await userEvent.type(input, 'b{Enter}');
    expect(onKeyDown).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('Ab');
  });

  it('lets aria-label override label', () => {
    render(<InlineEdit label="Title" aria-label="Component title" value="A" onCommit={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Component title' })).toBeInTheDocument();
  });
});
