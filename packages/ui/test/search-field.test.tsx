import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchField } from '../src/components/search-field';

describe('SearchField', () => {
  it('is a labelled searchbox', async () => {
    render(<SearchField label="Search decks" placeholder="Search decks" />);
    const input = screen.getByRole('searchbox', { name: 'Search decks' });
    await userEvent.type(input, 'orders');
    expect(input).toHaveValue('orders');
  });

  it('shows the shortcut hint, hidden from assistive technology', () => {
    render(<SearchField label="Search" shortcut="⌘K" />);
    const hint = screen.getByText('⌘K');
    expect(hint.tagName).toBe('KBD');
    expect(hint).toHaveAttribute('aria-hidden', 'true');
  });

  it('calls onClear on Escape', async () => {
    const onClear = vi.fn();
    render(<SearchField label="Search" onClear={onClear} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'x{Escape}');
    expect(onClear).toHaveBeenCalledOnce();
  });
});
