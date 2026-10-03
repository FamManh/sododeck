import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StepSticker } from './step-sticker';

describe('StepSticker', () => {
  it('shows a check and no number once the card is played', () => {
    render(<StepSticker state="played" number={null} />);
    const sticker = screen.getByTestId('step-sticker');
    expect(sticker).toHaveAttribute('data-step-state', 'played');
    expect(sticker.querySelector('svg')).not.toBeNull();
    expect(sticker).toHaveTextContent('');
  });

  it.each(['current', 'upcoming'] as const)('prints the step number on a %s card', (state) => {
    render(<StepSticker state={state} number="3" />);
    const sticker = screen.getByTestId('step-sticker');
    expect(sticker).toHaveAttribute('data-step-state', state);
    expect(sticker).toHaveTextContent('3');
    expect(sticker.querySelector('svg')).toBeNull();
  });

  it('is decorative: hidden from the accessibility tree and not focusable', () => {
    render(<StepSticker state="current" number="1" />);
    const sticker = screen.getByTestId('step-sticker');
    expect(sticker).toHaveAttribute('aria-hidden', 'true');
    expect(sticker).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('img')).toBeNull();
    expect(sticker.className).toContain('pointer-events-none');
  });

  it('keeps long numbers inside the disc instead of growing it', () => {
    render(<StepSticker state="upcoming" number="10a" />);
    const sticker = screen.getByTestId('step-sticker');
    expect(sticker).toHaveTextContent('10a');
    // The disc size comes from the token, never from its content.
    expect(sticker.style.width).toBe('var(--sd-step-sticker)');
    expect(sticker.className).toContain('overflow-hidden');
  });

  it('draws the current sticker larger than the others', () => {
    render(<StepSticker state="current" number="2" />);
    expect(screen.getByTestId('step-sticker').style.width).toBe('var(--sd-step-sticker-current)');
  });
});
