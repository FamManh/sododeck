import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { SegmentedControl, SegmentedControlItem } from '../src/components/segmented-control';

function View() {
  const [value, setValue] = useState('grid');
  return (
    <SegmentedControl aria-label="Layout" value={value} onValueChange={setValue}>
      <SegmentedControlItem value="grid">Grid</SegmentedControlItem>
      <SegmentedControlItem value="list">List</SegmentedControlItem>
      <SegmentedControlItem value="tree">Tree</SegmentedControlItem>
    </SegmentedControl>
  );
}

describe('SegmentedControl', () => {
  it('is a labelled group with the active option checked', () => {
    render(<View />);
    expect(screen.getByRole('radiogroup', { name: 'Layout' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Grid' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'List' })).toHaveAttribute('aria-checked', 'false');
  });

  it('moves the selection with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<View />);
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Grid' })).toHaveFocus();
    // Hold the key like a real press: Radix moves focus on a timeout and selects on focus
    // while an arrow key is down.
    await user.keyboard('{ArrowRight>}');
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'List' })).toHaveFocus();
    });
    await user.keyboard('{/ArrowRight}');
    expect(screen.getByRole('radio', { name: 'List' })).toHaveAttribute('aria-checked', 'true');
  });

  it('never becomes empty when the active option is clicked again', async () => {
    render(<View />);
    await userEvent.click(screen.getByRole('radio', { name: 'Grid' }));
    expect(screen.getByRole('radio', { name: 'Grid' })).toHaveAttribute('aria-checked', 'true');
  });
});
