import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { setActiveGesture } from './drag-session';
import { useGuideSafetyNet } from './use-guide-safety-net';

const ui = () => useUiStore.getState();

/** Leftovers of a gesture that never cleaned up after itself. */
function leaveLeftovers(gesture: 'bend' | 'card-resize' | 'pan' = 'bend') {
  ui().setCanvasGesture(gesture);
  ui().setGuides([{ axis: 'x', at: 10, from: 0, to: 100 }]);
  ui().setBendPreview({ edgeId: 'e', bends: [{ x: 1, y: 2 }] });
  ui().setLabelPreview({ edgeId: 'e', at: 0.3, snapped: false });
  ui().setConnectorReadout('x 1 · y 2');
  ui().setResizeReadout({ width: 200, height: 80, x: 0, y: 0 });
}

const flushMicrotasks = () =>
  act(async () => {
    await Promise.resolve();
  });

beforeEach(() => {
  ui().resetForDeck();
});

afterEach(() => {
  setActiveGesture(null);
});

const triggers: [string, () => void][] = [
  ['pointerup', () => window.dispatchEvent(new Event('pointerup'))],
  ['pointercancel', () => window.dispatchEvent(new Event('pointercancel'))],
  ['blur', () => window.dispatchEvent(new Event('blur'))],
  ['visibilitychange', () => document.dispatchEvent(new Event('visibilitychange'))],
];

describe('useGuideSafetyNet (050 R9)', () => {
  it.each(triggers)('window %s with no gesture running clears every leftover', async (_n, fire) => {
    renderHook(() => {
      useGuideSafetyNet();
    });
    act(() => {
      leaveLeftovers();
    });
    fire();
    await flushMicrotasks();
    expect(ui().guides).toHaveLength(0);
    expect(ui().bendPreview).toBeNull();
    expect(ui().labelPreview).toBeNull();
    expect(ui().connectorReadout).toBeNull();
    expect(ui().resizeReadout).toBeNull();
    expect(ui().canvasGesture).toBeNull();
  });

  it.each(triggers)('does nothing on %s while a gesture is running', async (_n, fire) => {
    renderHook(() => {
      useGuideSafetyNet();
    });
    act(() => {
      leaveLeftovers('card-resize');
      setActiveGesture({ cancel: () => true, arrow: () => false });
    });
    fire();
    await flushMicrotasks();
    expect(ui().guides).toHaveLength(1);
    expect(ui().bendPreview).not.toBeNull();
    expect(ui().resizeReadout).not.toBeNull();
    expect(ui().canvasGesture).toBe('card-resize');
  });

  it('leaves a pan alone: React Flow ends it itself', async () => {
    renderHook(() => {
      useGuideSafetyNet();
    });
    act(() => {
      leaveLeftovers('pan');
    });
    window.dispatchEvent(new Event('pointerup'));
    await flushMicrotasks();
    expect(ui().guides).toHaveLength(0);
    expect(ui().canvasGesture).toBe('pan');
  });

  it('checks after the event, so a gesture that ends on the same pointerup is not cut short', async () => {
    renderHook(() => {
      useGuideSafetyNet();
    });
    act(() => {
      leaveLeftovers();
      setActiveGesture({ cancel: () => true, arrow: () => false });
    });
    // The gesture's own release clears its state and unregisters during the same event.
    window.addEventListener(
      'pointerup',
      () => {
        setActiveGesture(null);
      },
      { once: true },
    );
    window.dispatchEvent(new Event('pointerup'));
    await flushMicrotasks();
    expect(ui().guides).toHaveLength(0);
  });

  it('removes its listeners on unmount', async () => {
    const { unmount } = renderHook(() => {
      useGuideSafetyNet();
    });
    unmount();
    act(() => {
      leaveLeftovers();
    });
    window.dispatchEvent(new Event('pointerup'));
    await flushMicrotasks();
    expect(ui().guides).toHaveLength(1);
  });
});
