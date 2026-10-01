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
  extra?: {
    deckColours?: readonly { hex: string }[];
    onPreview?: (channel: 'fill' | 'stroke', value: string | null) => void;
    onAddColour?: (channel: 'fill' | 'stroke', hex: string) => void;
  },
) {
  const onPreview = extra?.onPreview ?? vi.fn();
  const onAddColour = extra?.onAddColour ?? vi.fn();
  render(
    <TooltipProvider>
      <Popover open>
        <PopoverContent aria-label="Colour" className="w-[272px]">
          <StylePicker
            value={value}
            onApply={onApply}
            skipped={skipped}
            deckColours={extra?.deckColours}
            onPreview={onPreview}
            onAddColour={onAddColour}
          />
        </PopoverContent>
      </Popover>
    </TooltipProvider>,
  );
  return { onApply, onPreview, onAddColour, user: userEvent.setup() };
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

  describe('deck colours and the add panel (020 T043)', () => {
    const deckColours = [{ hex: '#7a3cff' }, { hex: '#1f2a44' }];

    it('lists the deck colours in a "Deck colours" radiogroup, then the "Add a deck colour" button', () => {
      renderPicker(noStyle, vi.fn(), undefined, { deckColours });
      const group = screen.getByRole('radiogroup', { name: 'Deck colours' });
      expect(within(group).getByRole('radio', { name: '#7a3cff' })).toBeInTheDocument();
      expect(within(group).getByRole('radio', { name: '#1f2a44' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add a deck colour' })).toBeInTheDocument();
    });

    it('"+" opens the panel with the "Hex colour" textbox', async () => {
      const { user } = renderPicker(noStyle, vi.fn(), undefined, { deckColours });
      await user.click(screen.getByRole('button', { name: 'Add a deck colour' }));
      expect(screen.getByRole('textbox', { name: 'Hex colour' })).toBeInTheDocument();
    });

    it('typing a valid hex enables Add and previews it', async () => {
      const { user, onPreview } = renderPicker(noStyle, vi.fn(), undefined, { deckColours });
      await user.click(screen.getByRole('button', { name: 'Add a deck colour' }));
      await user.type(screen.getByRole('textbox', { name: 'Hex colour' }), '7A3CFF');
      expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
      expect(onPreview).toHaveBeenLastCalledWith('fill', '#7a3cff');
    });

    it('an invalid hex disables Add and shows the error', async () => {
      const { user } = renderPicker(noStyle, vi.fn(), undefined, { deckColours });
      await user.click(screen.getByRole('button', { name: 'Add a deck colour' }));
      await user.type(screen.getByRole('textbox', { name: 'Hex colour' }), '#abc');
      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
      const hex = screen.getByRole('textbox', { name: 'Hex colour' });
      const errorId = hex.getAttribute('aria-describedby');
      expect(errorId).not.toBeNull();
      expect(document.getElementById(errorId ?? '')).toHaveTextContent(
        'Enter a 6-digit hex colour, e.g. #7a3cff',
      );
    });

    it('a low-contrast hex shows the readability warning, with Add still enabled', async () => {
      const { user } = renderPicker(noStyle, vi.fn(), undefined, { deckColours });
      await user.click(screen.getByRole('button', { name: 'Add a deck colour' }));
      await user.type(screen.getByRole('textbox', { name: 'Hex colour' }), '7c7c7c');
      expect(screen.getByText('Text may be hard to read on this colour')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    });

    it('Add calls onAddColour with the channel and normalized hex', async () => {
      const { user, onAddColour } = renderPicker(noStyle, vi.fn(), undefined, { deckColours });
      await user.click(screen.getByRole('button', { name: 'Add a deck colour' }));
      await user.type(screen.getByRole('textbox', { name: 'Hex colour' }), '7A3CFF');
      await user.click(screen.getByRole('button', { name: 'Add' }));
      expect(onAddColour).toHaveBeenCalledWith('fill', '#7a3cff');
    });

    it('Cancel and Esc call onPreview(null) and return to the palette', async () => {
      const { user, onPreview } = renderPicker(noStyle, vi.fn(), undefined, { deckColours });
      await user.click(screen.getByRole('button', { name: 'Add a deck colour' }));
      await user.type(screen.getByRole('textbox', { name: 'Hex colour' }), '7A3CFF');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onPreview).toHaveBeenLastCalledWith('fill', null);
      expect(screen.getByRole('radiogroup', { name: 'Colours' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Add a deck colour' }));
      await user.keyboard('{Escape}');
      expect(onPreview).toHaveBeenLastCalledWith('fill', null);
      expect(screen.getByRole('radiogroup', { name: 'Colours' })).toBeInTheDocument();
    });

    it('hides "+" and shows the cap footer at 12 deck colours', () => {
      const twelve = Array.from({ length: 12 }, (_, i) => ({
        hex: `#${String(i).padStart(6, '0')}`,
      }));
      renderPicker(noStyle, vi.fn(), undefined, { deckColours: twelve });
      expect(screen.queryByRole('button', { name: 'Add a deck colour' })).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(
        '12 of 12 deck colours: remove one to add another',
      );
    });

    it('a fill hex not in the deck list shows no checked radio, and the footer shows the hex (020 T050)', () => {
      const value: StylePickerValue = {
        fill: { mixed: false, value: '#abcdef' },
        stroke: { mixed: false, value: null },
      };
      renderPicker(value, vi.fn(), undefined, { deckColours });
      const colourGroups = [
        screen.getByRole('radiogroup', { name: 'Colours' }),
        screen.getByRole('radiogroup', { name: 'Deck colours' }),
      ];
      for (const group of colourGroups) {
        for (const radio of within(group).getAllByRole('radio')) {
          expect(radio).toHaveAttribute('aria-checked', 'false');
        }
      }
      expect(screen.getByRole('status')).toHaveTextContent('#abcdef');
    });
  });
});
