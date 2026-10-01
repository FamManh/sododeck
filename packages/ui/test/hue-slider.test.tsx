import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HueSlider } from '../src/components/hue-slider';

describe('HueSlider (020 T042)', () => {
  it('is a slider named "Hue" ranging 0–359 with an aria-valuetext', () => {
    render(<HueSlider hue={262} onChange={() => {}} />);
    const slider = screen.getByRole('slider', { name: 'Hue' });
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '359');
    expect(slider).toHaveAttribute('aria-valuenow', '262');
    expect(slider).toHaveAttribute('aria-valuetext', 'Hue 262°');
  });

  it('steps by 1, or 10 with shift, and clamps at the edges', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HueSlider hue={5} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Hue' });
    slider.focus();

    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(4);
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('clamps at 0', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HueSlider hue={0} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Hue' });
    slider.focus();

    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('clamps at 359', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HueSlider hue={358} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Hue' });
    slider.focus();

    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(onChange).toHaveBeenLastCalledWith(359);
  });
});
