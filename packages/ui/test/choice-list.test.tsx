import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChoiceList, type ChoiceOption } from '../src/components/choice-list';

const OWNERS: ChoiceOption[] = [
  { value: 'Payments team', label: 'Payments team', state: 'selected' },
  { value: 'Platform', label: 'Platform' },
  { value: 'Search', label: 'Search' },
];

const useText = (typed: string) =>
  typed.trim() === '' || OWNERS.some((o) => o.label === typed.trim())
    ? null
    : `Use '${typed.trim()}'`;

describe('ChoiceList', () => {
  it('focuses its filter, marks the current value and names the list', () => {
    render(
      <ChoiceList
        label="Owner options"
        filterLabel="Filter owner"
        options={OWNERS}
        none={{ label: 'No owner' }}
        onPick={vi.fn()}
      />,
    );
    expect(screen.getByRole('searchbox', { name: 'Filter owner' })).toHaveFocus();
    const list = screen.getByRole('listbox', { name: 'Owner options' });
    expect(within(list).getByRole('option', { name: 'Payments team' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(list).getByRole('option', { name: 'Platform' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('filters the list as the user types, and Enter picks the highlighted option', async () => {
    const onPick = vi.fn();
    render(
      <ChoiceList
        label="Owner options"
        filterLabel="Filter owner"
        options={OWNERS}
        onPick={onPick}
      />,
    );
    await userEvent.keyboard('pla');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Platform']);
    await userEvent.keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith('Platform');
  });

  it('moves the active option with ↑ / ↓ through aria-activedescendant', async () => {
    const onPick = vi.fn();
    render(
      <ChoiceList
        label="Owner options"
        filterLabel="Filter owner"
        options={OWNERS}
        onPick={onPick}
      />,
    );
    const filter = screen.getByRole('searchbox', { name: 'Filter owner' });
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    const active = filter.getAttribute('aria-activedescendant') ?? '';
    expect(document.getElementById(active)).toHaveTextContent('Search');
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(onPick).toHaveBeenCalledWith('Platform');
  });

  it('offers "none", which picks null', async () => {
    const onPick = vi.fn();
    render(
      <ChoiceList
        label="Owner options"
        filterLabel="Filter owner"
        options={OWNERS}
        none={{ label: 'No owner' }}
        onPick={onPick}
      />,
    );
    await userEvent.click(screen.getByRole('option', { name: 'No owner' }));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('shows "Use \'x\'" only when create returns text, and picks the typed value', async () => {
    const onPick = vi.fn();
    render(
      <ChoiceList
        label="Owner options"
        filterLabel="Filter owner"
        options={OWNERS}
        create={useText}
        onPick={onPick}
      />,
    );
    expect(screen.queryByRole('option', { name: /^Use / })).toBeNull();
    await userEvent.keyboard('Search');
    expect(screen.queryByRole('option', { name: /^Use / })).toBeNull();
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.keyboard(' Billing ');
    await userEvent.click(screen.getByRole('option', { name: "Use 'Billing'" }));
    expect(onPick).toHaveBeenCalledWith('Billing');
  });

  it('says "Mixed" in text when the selection differs', () => {
    render(
      <ChoiceList
        label="Owner options"
        filterLabel="Filter owner"
        options={OWNERS.map((o) => ({ value: o.value, label: o.label }))}
        mixed
        onPick={vi.fn()}
      />,
    );
    expect(screen.getByText('Mixed')).toBeInTheDocument();
  });

  it('shows partial tags with their count in text, and toggles in multiple mode', async () => {
    const onPick = vi.fn();
    render(
      <ChoiceList
        label="Tags options"
        filterLabel="Filter tags"
        multiple
        options={[
          { value: 'pci', label: 'pci', state: 'partial', count: '2 of 3' },
          { value: 'edge', label: 'edge', state: 'selected' },
        ]}
        onPick={onPick}
      />,
    );
    const list = screen.getByRole('listbox', { name: 'Tags options' });
    expect(list).toHaveAttribute('aria-multiselectable', 'true');
    const partial = screen.getByRole('option', { name: 'pci, 2 of 3' });
    expect(partial).toHaveTextContent('2 of 3');
    await userEvent.keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith('pci');
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('lets Escape bubble to the popover', async () => {
    const onKeyDown = vi.fn<(key: string) => void>();
    render(
      <div
        onKeyDown={(event) => {
          onKeyDown(event.key);
        }}
      >
        <ChoiceList
          label="Kind options"
          filterLabel="Filter kind"
          options={OWNERS}
          onPick={vi.fn()}
        />
      </div>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onKeyDown).toHaveBeenCalledWith('Escape');
  });
});
