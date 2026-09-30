import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SwatchGrid } from '../src/components/swatch-grid';

const options = Array.from({ length: 13 }, (_, i) => ({
  value: `c${String(i)}`,
  label: `Colour ${String(i)}`,
  swatch: `#${String(i).padStart(6, '0')}`,
}));

describe('SwatchGrid', () => {
  it('is a radiogroup with a name, holding radios named by their labels', () => {
    render(<SwatchGrid label="Colours" options={options} value={null} onSelect={() => {}} />);
    const group = screen.getByRole('radiogroup', { name: 'Colours' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(13);
    expect(screen.getByRole('radio', { name: 'Colour 0' })).toBeInTheDocument();
  });

  it('checks nothing when value is null', () => {
    render(<SwatchGrid label="Colours" options={options} value={null} onSelect={() => {}} />);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('marks the checked radio with aria-checked and a check icon', () => {
    render(<SwatchGrid label="Colours" options={options} value="c2" onSelect={() => {}} />);
    const checked = screen.getByRole('radio', { name: 'Colour 2' });
    expect(checked).toHaveAttribute('aria-checked', 'true');
    expect(checked.querySelector('svg')).not.toBeNull();
  });

  it('takes the swatch colour from a CSS custom property, not a class', () => {
    render(<SwatchGrid label="Colours" options={options} value={null} onSelect={() => {}} />);
    const radio = screen.getByRole('radio', { name: 'Colour 0' });
    expect(radio.style.getPropertyValue('--swatch')).toBe('#000000');
    expect(radio.className).not.toMatch(/bg-/);
  });

  it('moves a roving tabindex with arrow keys, and wraps rows at the column count', async () => {
    const user = userEvent.setup();
    render(
      <SwatchGrid label="Colours" options={options} value={null} columns={7} onSelect={() => {}} />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('tabindex', '0');
    for (const radio of radios.slice(1)) expect(radio).toHaveAttribute('tabindex', '-1');

    await user.tab();
    expect(radios[0]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(radios[1]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(radios[8]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(radios[1]).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(radios[0]).toHaveFocus();
    await user.keyboard('{End}');
    expect(radios[12]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(radios[0]).toHaveFocus();
  });

  it('applies the focused option with Enter or Space', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SwatchGrid label="Colours" options={options} value={null} onSelect={onSelect} />);
    await user.tab();
    await user.keyboard('{ArrowRight}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('c1');
    await user.keyboard('{ArrowRight}{ }');
    expect(onSelect).toHaveBeenCalledWith('c2');
  });
});
