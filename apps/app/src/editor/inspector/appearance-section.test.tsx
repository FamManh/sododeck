import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@sododeck/ui/components/tooltip';
import { useUiStore } from '../../state/ui-store';
import { AppearanceSection } from './appearance-section';
import type { StylePickerValue } from '../style/style-picker';

const noStyle: StylePickerValue = {
  fill: { mixed: false, value: null },
  stroke: { mixed: false, value: null },
};

function renderSection(value: StylePickerValue, onApply = vi.fn()) {
  render(
    <TooltipProvider>
      <AppearanceSection value={value} onApply={onApply} />
    </TooltipProvider>,
  );
  return { onApply, user: userEvent.setup() };
}

describe('AppearanceSection (020 T034)', () => {
  beforeEach(() => {
    useUiStore.getState().setStylePickerTab('fill');
  });

  it('shows a PanelSection "Appearance" with "Fill: none" and "Stroke: none" buttons', () => {
    renderSection(noStyle);
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    const fill = screen.getByRole('button', { name: 'Fill: none' });
    const stroke = screen.getByRole('button', { name: 'Stroke: none' });
    expect(fill).toHaveAttribute('aria-haspopup', 'dialog');
    expect(stroke).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('shows "Fill: Green" / "Stroke: Mixed" for the checked or mixed value', () => {
    renderSection({ fill: { mixed: false, value: 'green' }, stroke: { mixed: true } });
    expect(screen.getByRole('button', { name: 'Fill: Green' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stroke: Mixed' })).toBeInTheDocument();
  });

  it('opens the picker with Fill preselected from the Fill row', async () => {
    const { user } = renderSection(noStyle);
    await user.click(screen.getByRole('button', { name: 'Fill: none' }));
    const dialog = await screen.findByRole('dialog', { name: 'Colour' });
    expect(within(dialog).getByRole('radio', { name: 'Fill' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('opens the picker with Stroke preselected from the Stroke row', async () => {
    const { user } = renderSection(noStyle);
    await user.click(screen.getByRole('button', { name: 'Stroke: none' }));
    const dialog = await screen.findByRole('dialog', { name: 'Colour' });
    expect(within(dialog).getByRole('radio', { name: 'Stroke' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('picking a colour from the Fill row calls onApply("fill", ...)', async () => {
    const { onApply, user } = renderSection(noStyle);
    await user.click(screen.getByRole('button', { name: 'Fill: none' }));
    await user.click(screen.getByRole('radio', { name: 'Green' }));
    expect(onApply).toHaveBeenCalledWith('fill', 'green');
  });
});
