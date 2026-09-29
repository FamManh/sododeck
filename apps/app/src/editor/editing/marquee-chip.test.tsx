import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { MarqueeChip } from './marquee-chip';

describe('MarqueeChip (016 R13, screen 108)', () => {
  it('shows the count next to the pointer while a marquee runs', () => {
    render(<MarqueeChip />);
    expect(screen.queryByTestId('marquee-chip')).toBeNull();
    act(() => {
      useUiStore.getState().setMarqueeCount(3);
    });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 50 });
    const chip = screen.getByTestId('marquee-chip');
    expect(chip).toHaveTextContent('3');
    expect(chip).toHaveAttribute('aria-hidden', 'true');
    expect(chip.style.left).toBe('112px');
    act(() => {
      useUiStore.getState().setMarqueeCount(null);
    });
    expect(screen.queryByTestId('marquee-chip')).toBeNull();
  });
});
