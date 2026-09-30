import { Popover, PopoverContent } from '@sododeck/ui/components/popover';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@sododeck/ui/components/tooltip';
import { useUiStore } from '../../state/ui-store';
import { StylePicker, type StylePickerValue } from './style-picker';

function renderPicker(
  value: StylePickerValue,
  onApply = vi.fn(),
  skipped?: { colored: number; total: number },
) {
  render(
    <TooltipProvider>
      <Popover open>
        <PopoverContent aria-label="Colour" className="w-[272px]">
          <StylePicker value={value} onApply={onApply} skipped={skipped} />
        </PopoverContent>
      </Popover>
    </TooltipProvider>,
  );
  return { onApply, user: userEvent.setup() };
}

const noStyle: StylePickerValue = {
  fill: { mixed: false, value: null },
  stroke: { mixed: false, value: null },
};

describe('StylePicker (020 T024)', () => {
  beforeEach(() => {
    useUiStore.getState().resetForDeck();
    useUiStore.getState().setStylePickerTab('fill');
  });

  it('shows a dialog "Colour" with the Colour target tabs, No colour and the Colours grid', () => {
    renderPicker(noStyle);
    const dialog = screen.getByRole('dialog', { name: 'Colour' });
    expect(within(dialog).getByRole('radiogroup', { name: 'Colour target' })).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'Fill' })).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'Stroke' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'No colour' })).toBeInTheDocument();
    const colours = within(dialog).getByRole('radiogroup', { name: 'Colours' });
    expect(within(colours).getAllByRole('radio')).toHaveLength(13);
    for (const name of ['Red', 'Orange', 'Amber', 'Yellow', 'Lime', 'Green', 'Teal']) {
      expect(within(colours).getByRole('radio', { name })).toBeInTheDocument();
    }
    expect(within(colours).getByRole('radio', { name: 'Slate' })).toBeInTheDocument();
  });

  it('picking Green calls onApply("fill", "green")', async () => {
    const { onApply, user } = renderPicker(noStyle);
    await user.click(screen.getByRole('radio', { name: 'Green' }));
    expect(onApply).toHaveBeenCalledWith('fill', 'green');
  });

  it('switching to Stroke then picking Blue calls onApply("stroke", "blue")', async () => {
    const { onApply, user } = renderPicker(noStyle);
    await user.click(screen.getByRole('radio', { name: 'Stroke' }));
    await user.click(screen.getByRole('radio', { name: 'Blue' }));
    expect(onApply).toHaveBeenCalledWith('stroke', 'blue');
  });

  it('"No colour" calls onApply("fill", null)', async () => {
    const { onApply, user } = renderPicker({
      fill: { mixed: false, value: 'green' },
      stroke: { mixed: false, value: null },
    });
    await user.click(screen.getByRole('button', { name: 'No colour' }));
    expect(onApply).toHaveBeenCalledWith('fill', null);
  });

  it('marks "No colour" pressed only when the channel is unset', () => {
    renderPicker(noStyle);
    expect(screen.getByRole('button', { name: 'No colour' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows "Green · card-green-fill" in the footer for the checked swatch', () => {
    renderPicker({ fill: { mixed: false, value: 'green' }, stroke: { mixed: false, value: null } });
    expect(screen.getByRole('status')).toHaveTextContent('Green · card-green-fill');
  });

  it("shows the hovered swatch's name and token in the footer", async () => {
    const { user } = renderPicker(noStyle);
    await user.hover(screen.getByRole('radio', { name: 'Green' }));
    expect(screen.getByRole('status')).toHaveTextContent('Green · card-green-fill');
  });

  it('reads "Mixed" in the footer for a mixed channel with nothing hovered', () => {
    renderPicker({ fill: { mixed: true }, stroke: { mixed: false, value: null } });
    expect(screen.getByRole('status')).toHaveTextContent('Mixed');
  });

  it('checks no radio when the fill channel is mixed (020 T035)', () => {
    renderPicker({ fill: { mixed: true }, stroke: { mixed: false, value: null } });
    const colours = screen.getByRole('radiogroup', { name: 'Colours' });
    expect(within(colours).queryAllByRole('radio', { checked: true })).toHaveLength(0);
  });

  it('checks Amber when every target shares it (020 T035)', () => {
    renderPicker({ fill: { mixed: false, value: 'amber' }, stroke: { mixed: false, value: null } });
    expect(screen.getByRole('radio', { name: 'Amber' })).toHaveAttribute('aria-checked', 'true');
  });

  it('marks "No colour" not pressed when a target has a colour (020 T035)', () => {
    renderPicker({ fill: { mixed: false, value: 'green' }, stroke: { mixed: false, value: null } });
    expect(screen.getByRole('button', { name: 'No colour' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('reads "Colours 1 of 2 selected items" when an item was skipped (020 T036/T037)', () => {
    renderPicker(noStyle, vi.fn(), { colored: 1, total: 2 });
    expect(screen.getByRole('status')).toHaveTextContent('Colours 1 of 2 selected items');
  });
});
