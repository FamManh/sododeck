import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { GestureHint } from './gesture-hint';
import { gestureHint, hintText } from './gesture-hints';

const ui = () => useUiStore.getState();

describe('gesture hints (016 R13, 017 R14, contract "Hint bar texts")', () => {
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
    expect(hintText(gestureHint('card-resize', true))).toBe(
      '⇧ Keep ratio · ⌥ From centre · ⌘ No snap · Esc Cancel',
    );
    expect(hintText(gestureHint('card-resize', false))).toBe(
      'Shift Keep ratio · Alt From centre · Ctrl No snap · Esc Cancel',
    );
    expect(hintText(gestureHint('bend', true))).toBe('⌘ No snap · R Reset route · Esc Cancel');
    expect(hintText(gestureHint('bend', false))).toBe('Ctrl No snap · R Reset route · Esc Cancel');
    expect(hintText(gestureHint('endpoint', true))).toBe(
      'Drop on a side to pin it · Esc Keep old end',
    );
    expect(hintText(gestureHint('endpoint', false))).toBe(
      'Drop on a side to pin it · Esc Keep old end',
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
    act(() => {
      useUiStore.setState({ hideUi: false, canvasGesture: null });
    });
  });

  it('shows, announces once and hides for the new 017 gestures', () => {
    render(<GestureHint />);
    act(() => {
      ui().setCanvasGesture('card-resize');
    });
    expect(screen.getByTestId('gesture-hint')).toHaveTextContent(
      /Keep ratio.*From centre.*No snap.*Cancel/,
    );
    const resizeAnnounced = ui().announcement;
    expect(resizeAnnounced.text).toMatch(/Keep ratio · .* From centre · .* No snap · Esc Cancel/);
    act(() => {
      ui().setCanvasGesture(null);
    });
    expect(screen.queryByTestId('gesture-hint')).toBeNull();

    act(() => {
      ui().setCanvasGesture('endpoint');
    });
    expect(screen.getByTestId('gesture-hint')).toHaveTextContent(
      /Drop on a side to pin it.*Keep old end/,
    );
    expect(ui().announcement.text).toBe('Drop on a side to pin it · Esc Keep old end');
    expect(ui().announcement).not.toBe(resizeAnnounced);
    act(() => {
      ui().setCanvasGesture(null);
    });
    expect(screen.queryByTestId('gesture-hint')).toBeNull();
  });
});
