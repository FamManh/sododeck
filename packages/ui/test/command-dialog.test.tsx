import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Command, Search, Workflow } from 'lucide-react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommandDialog, type CommandDialogItem } from '../src/components/command-dialog';

function Harness({
  items = SAMPLE_ITEMS,
  total = items.length,
  onSelect = () => undefined,
  onOpenChange = () => undefined,
}: {
  items?: readonly CommandDialogItem[];
  total?: number;
  onSelect?: (item: CommandDialogItem) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  return (
    <CommandDialog
      open
      query={query}
      total={total}
      items={items}
      onQueryChange={setQuery}
      onOpenChange={onOpenChange}
      onSelect={onSelect}
      emptyState={
        <div>
          <p>No results</p>
          <p>Try a different word.</p>
        </div>
      }
    />
  );
}

const SAMPLE_ITEMS: readonly CommandDialogItem[] = [
  {
    id: 'command-theme',
    title: 'Switch theme',
    titleRanges: [{ start: 0, end: 6 }],
    meta: 'Command',
    icon: <Command aria-hidden />,
    shortcut: '⌘⇧L',
  },
  {
    id: 'flow-place-order',
    title: 'Place order',
    meta: 'Flow · 8 steps',
    icon: <Workflow aria-hidden />,
  },
  {
    id: 'note-retry',
    title: 'Retry note',
    meta: 'Note',
    icon: <Search aria-hidden />,
    snippet: {
      text: '…text with retry highlighted…',
      ranges: [{ start: 11, end: 16 }],
    },
  },
];

afterEach(() => {
  vi.useRealTimers();
});

describe('CommandDialog', () => {
  it('renders the jump dialog, combobox, result list and first highlighted option', () => {
    render(<Harness />);
    expect(screen.getByRole('dialog', { name: 'Jump to' })).toBeInTheDocument();
    const input = screen.getByRole('combobox', { name: 'Search the deck' });
    const list = screen.getByRole('listbox', { name: 'Results' });
    const options = within(list).getAllByRole('option');
    expect(input).toHaveAttribute('aria-controls', list.id);
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('moves with arrows without wrapping, supports Home and End, and Enter selects', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const input = screen.getByRole('combobox', { name: 'Search the deck' });

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    const options = screen.getAllByRole('option');
    expect(input).toHaveAttribute('aria-activedescendant', options[2]?.id);

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', options[2]?.id);

    await user.keyboard('{Home}');
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);

    await user.keyboard('{End}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(SAMPLE_ITEMS[2]);
  });

  it('closes on Escape and hover moves the highlight', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    const input = screen.getByRole('combobox', { name: 'Search the deck' });
    const target = screen.getAllByRole('option')[1];
    if (target === undefined) throw new Error('Expected a second option');

    await user.hover(target);
    expect(input).toHaveAttribute('aria-activedescendant', target.id);

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders highlighted title and snippet ranges, the footer hint, and the empty state', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness />);

    const dialog = screen.getByRole('dialog', { name: 'Jump to' });
    expect(within(dialog).getByText('Switch')).toHaveClass('underline');
    expect(within(dialog).getByText('retry')).toHaveClass('underline');
    expect(screen.getByText('↵ open · esc close')).toBeInTheDocument();

    rerender(<Harness items={[]} total={0} />);
    await user.click(screen.getByRole('combobox', { name: 'Search the deck' }));
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByText('Try a different word.')).toBeInTheDocument();
  });

  it('announces results and no-results through a debounced status region', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness total={7} />);

    expect(screen.getByRole('status')).toHaveTextContent('');
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('7 results');
    });

    rerender(<Harness items={[]} total={0} />);
    await user.click(screen.getByRole('combobox', { name: 'Search the deck' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('No results');
    });
  });
});
