import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ColourArea } from '../src/components/colour-area';

describe('ColourArea (020 T042)', () => {
  it('is a slider named "Saturation and brightness" with an aria-valuetext', () => {
    render(<ColourArea hue={262} saturation={0.6} value={0.4} onChange={() => {}} />);
    const slider = screen.getByRole('slider', { name: 'Saturation and brightness' });
    expect(slider).toHaveAttribute('aria-valuetext', 'Saturation 60 %, brightness 40 %');
  });

  it('steps saturation and brightness by 1, or 10 with shift, and clamps at the edges', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColourArea hue={0} saturation={0.5} value={0.5} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Saturation and brightness' });
    slider.focus();

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith({ s: 0.51, v: 0.5 });
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith({ s: 0.5, v: 0.51 });
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(onChange).toHaveBeenLastCalledWith({ s: 0.4, v: 0.5 });
  });

  it('clamps saturation and brightness to [0, 1]', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColourArea hue={0} saturation={0} value={1} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Saturation and brightness' });
    slider.focus();

    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith({ s: 0, v: 1 });
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith({ s: 0, v: 1 });
  });

  it('builds its gradient from the hue prop through a CSS custom property', () => {
    render(<ColourArea hue={120} saturation={0.5} value={0.5} onChange={() => {}} />);
    const slider = screen.getByRole('slider', { name: 'Saturation and brightness' });
    expect(slider.style.getPropertyValue('--hue')).toBe('120');
  });
});
