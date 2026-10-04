import { ICON_SETS, resolveIcon, type IconSet, type ResolvedIcon } from '@sododeck/ui/icon-sets';
import { Popover, PopoverContent, PopoverAnchor } from '@sododeck/ui/components/popover';
import { TooltipProvider } from '@sododeck/ui/components/tooltip';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IconPicker, type IconPickerProps } from './icon-picker';

const icon = (ref: string): ResolvedIcon => {
  const resolved = resolveIcon(ref);
  if (resolved === null) throw new Error(`no icon ${ref}`);
  return resolved;
};

/** A tiny filled set, to prove the picker needs nothing but the `IconSet` shape (FR-013). */
const solid: IconSet = {
  id: 'solid-test',
  name: 'Solid test',
  licence: { spdx: 'MIT', notice: 'Test.' },
  style: 'solid',
  categories: [{ id: 'shapes', label: 'Solid shapes' }],
  aliases: {},
  icons: [
    {
      name: 'square',
      label: 'Square',
      category: 'shapes',
      keywords: [],
      node: [['path', { d: 'M4 4h16v16H4z' }]],
    },
  ],
};

function setup(props: Partial<IconPickerProps> = {}) {
  const onPick = vi.fn();
  const onReset = vi.fn();
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <Popover open onOpenChange={onClose}>
        <PopoverAnchor />
        <PopoverContent aria-label="Choose icon">
          <IconPicker
            current={null}
            cardCount={1}
            showScope={false}
            canReset={false}
            usage={[]}
            onPick={onPick}
            onReset={onReset}
            {...props}
          />
        </PopoverContent>
      </Popover>
    </TooltipProvider>,
  );
  return { user, onPick, onReset, onClose };
}

describe('IconPicker (038 T019)', () => {
  it('is a dialog with a focused search box and one grid per category', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Choose icon' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search icons' })).toHaveFocus();
    const lucide = ICON_SETS[0];
    expect(lucide).toBeDefined();
    for (const category of lucide?.categories ?? []) {
      expect(screen.getByRole('grid', { name: category.label })).toBeInTheDocument();
    }
    expect(screen.queryByRole('radiogroup', { name: 'Icon set' })).not.toBeInTheDocument();
  });

  it('lists the best match first while searching and shows the empty state', async () => {
    const { user } = setup();
    await user.type(screen.getByRole('searchbox', { name: 'Search icons' }), 'search');
    const results = screen.getByRole('grid', { name: 'Results' });
    const first = within(results).getAllByRole('gridcell')[0];
    expect(first && within(first).getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: 'Compute' })).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Search icons' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search icons' }), 'zzzz');
    expect(screen.getByText('No icons match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('searchbox', { name: 'Search icons' })).toHaveValue('');
    expect(screen.getByRole('grid', { name: 'Compute' })).toBeInTheDocument();
  });

  it('marks the current icon selected with a check, and shows Mixed with none selected', () => {
    setup({ current: icon('lucide:search') });
    const selected = screen.getAllByRole('gridcell', { selected: true });
    expect(selected).toHaveLength(1);
    expect(
      within(selected[0] as HTMLElement).getByRole('button', { name: 'Search' }),
    ).toBeVisible();
    expect(selected[0]?.querySelector('[data-check]')).not.toBeNull();
  });

  it('shows Mixed and selects nothing when the selection disagrees', () => {
    setup({ current: 'mixed', showScope: true, cardCount: 5 });
    expect(screen.getByText('Mixed')).toBeInTheDocument();
    expect(screen.queryAllByRole('gridcell', { selected: true })).toHaveLength(0);
    expect(screen.getByText('Changes 5 cards')).toBeInTheDocument();
  });

  it('applies an icon on click with its ref, and on Enter', async () => {
    const { user, onPick } = setup();
    await user.click(screen.getByRole('button', { name: 'Zap' }));
    expect(onPick).toHaveBeenLastCalledWith('lucide:zap');
    await user.type(screen.getByRole('searchbox', { name: 'Search icons' }), 'database{Enter}');
    expect(onPick).toHaveBeenLastCalledWith('lucide:database');
  });

  it('names every cell by its label and echoes the focused one in the footer', async () => {
    const { user } = setup({ current: icon('lucide:zap') });
    const footer = screen.getByTestId('icon-picker-footer');
    expect(footer).toHaveTextContent('Zap');
    await user.hover(screen.getByRole('button', { name: 'Database' }));
    expect(footer).toHaveTextContent('Database');
  });

  it('moves with arrow keys inside and across sections, as one tab stop', async () => {
    const { user } = setup({ canReset: true });
    await user.keyboard('{ArrowDown}');
    const first = document.activeElement;
    expect(first?.closest('[role="gridcell"]')).not.toBeNull();
    const firstGrid = first?.closest('[role="grid"]');
    await user.keyboard('{ArrowRight}');
    const second = document.activeElement;
    expect(second).not.toBe(first);
    expect(second?.closest('[role="grid"]')).toBe(firstGrid);
    await user.keyboard('{ArrowDown}');
    const below = document.activeElement;
    expect(below).not.toBe(second);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(second);
    // Tab leaves the grids for Reset: search, one grid stop, Reset.
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reset to type icon' }));
  });

  it('forwards printable keys typed on a cell to the search box', async () => {
    const { user } = setup();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('ab');
    expect(screen.getByRole('searchbox', { name: 'Search icons' })).toHaveValue('ab');
    expect(screen.getByRole('searchbox', { name: 'Search icons' })).toHaveFocus();
  });

  it('resets, disabling Reset when no card has an icon', () => {
    const off = setup({ canReset: false });
    expect(screen.getByRole('button', { name: 'Reset to type icon' })).toBeDisabled();
    expect(off.onReset).not.toHaveBeenCalled();
  });

  it('calls onReset from an enabled Reset button', async () => {
    const { user, onReset } = setup({ canReset: true });
    await user.click(screen.getByRole('button', { name: 'Reset to type icon' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const { user, onClose } = setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('offers a set filter only with two or more sets and searches within the chosen set', async () => {
    const { user } = setup({ sets: [...ICON_SETS, solid] });
    const group = screen.getByRole('radiogroup', { name: 'Icon set' });
    expect(within(group).getByRole('radio', { name: 'Lucide' })).toBeChecked();
    await user.click(within(group).getByRole('radio', { name: 'Solid test' }));
    expect(screen.getByRole('grid', { name: 'Solid shapes' })).toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: 'Compute' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Square' })).toBeInTheDocument();
  });
});
