import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { TableTab } from '../../state/ui-store';
import { useUiStore } from '../../state/ui-store';
import { DrawerTabs } from './drawer-tabs';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'columns', label: 'Columns' },
  { id: 'indexes', label: 'Indexes' },
  { id: 'checks', label: 'Checks' },
] as const;

function Harness({ initial = 'general' }: { initial?: TableTab }) {
  const [tab, setTab] = useState<TableTab>(initial);
  return (
    <DrawerTabs tabs={TABS} tab={tab} onChange={setTab} label="Table sections" idPrefix="table">
      <p>{`panel ${tab}`}</p>
    </DrawerTabs>
  );
}

describe('DrawerTabs', () => {
  it('shows a tablist with four tabs and the labelled panel', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Table sections' })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['General', 'Columns', 'Indexes', 'Checks']);
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel', { name: 'General' });
    expect(panel).toHaveTextContent('panel general');
  });

  it('moves and selects with arrows, Home and End', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('tab', { name: 'General' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Columns' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Columns' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Checks' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'General' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Checks' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'General' })).toBeInTheDocument();
  });

  it('announces a tab change', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('tab', { name: 'Indexes' }));
    expect(useUiStore.getState().announcement.text).toBe('Indexes tab');
  });
});
