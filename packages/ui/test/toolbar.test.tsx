import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Toolbar, ToolbarButton, ToolbarSeparator, ToolbarText } from '../src/components/toolbar';

function SelectionBar({ onKind }: { onKind?: () => void }) {
  return (
    <Toolbar aria-label="Selection: Order Service">
      <ToolbarText>1 selected</ToolbarText>
      <ToolbarButton aria-label="Open details">D</ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton onClick={onKind}>Kind</ToolbarButton>
      <ToolbarButton disabled>Links</ToolbarButton>
      <ToolbarButton>Rules</ToolbarButton>
    </Toolbar>
  );
}

describe('Toolbar', () => {
  it('is a horizontal toolbar named for its selection', () => {
    render(<SelectionBar />);
    const toolbar = screen.getByRole('toolbar', { name: 'Selection: Order Service' });
    expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(toolbar.querySelector('[data-slot="toolbar-separator"]')).not.toBeNull();
  });

  it('moves focus with the arrow keys, Home and End, skipping disabled buttons', async () => {
    render(<SelectionBar />);
    const details = screen.getByRole('button', { name: 'Open details' });
    details.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Kind' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Rules' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'Kind' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Rules' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(details).toHaveFocus();
  });

  it('is one Tab stop and runs buttons', async () => {
    const onKind = vi.fn();
    render(<SelectionBar onKind={onKind} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Open details' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}{Enter}');
    expect(onKind).toHaveBeenCalledTimes(1);
  });
});
