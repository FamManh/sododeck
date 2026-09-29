import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { GestureHint } from './gesture-hint';
import { gestureHint, hintText } from './gesture-hints';

const ui = () => useUiStore.getState();

describe('gesture hints (016 R13, contract "Hint bar texts")', () => {
  it('has the contract text for each gesture, with Alt / Ctrl / Shift outside macOS', () => {
    expect(hintText(gestureHint('marquee', true))).toBe('⇧ Add · ⌥ Touch · Esc Cancel');
    expect(hintText(gestureHint('drag', true))).toBe(
      '⌥ Duplicate / No group · ⇧ Lock axis · ⌘ No snap · Esc Cancel',
    );
    expect(hintText(gestureHint('group-drag', true))).toBe(
      '⌥ Duplicate · ⇧ Lock axis · ⌘ No snap · Esc Cancel',
    );
    expect(hintText(gestureHint('resize', true))).toBe('⇧ Keep ratio · ⌥ From centre · Esc Cancel');
    expect(hintText(gestureHint('resize', false))).toBe(
      'Shift Keep ratio · Alt From centre · Esc Cancel',
    );
    expect(gestureHint('pan')).toEqual([]);
    expect(gestureHint(null)).toEqual([]);
  });
});

describe('GestureHint', () => {
  it('shows the bar during a gesture and announces it once', () => {
    render(<GestureHint />);
    expect(screen.queryByTestId('gesture-hint')).toBeNull();
    act(() => {
      ui().setCanvasGesture('marquee');
    });
    expect(screen.getByTestId('gesture-hint')).toHaveTextContent(/Add.*Touch.*EscCancel/);
    const announced = ui().announcement;
    expect(announced.text).toMatch(/Add · .* Touch · Esc Cancel$/);
    act(() => {
      ui().setMarqueeCount(3);
    });
    expect(ui().announcement).toBe(announced);
    act(() => {
      ui().setCanvasGesture(null);
    });
    expect(screen.queryByTestId('gesture-hint')).toBeNull();
  });

  it('is hidden with Hide UI', () => {
    render(<GestureHint />);
    act(() => {
      useUiStore.setState({ hideUi: true });
      ui().setCanvasGesture('drag');
    });
    expect(screen.queryByTestId('gesture-hint')).toBeNull();
  });
});
